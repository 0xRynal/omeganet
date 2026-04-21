import { Players, ReplicatedStorage, RunService } from "@rbxts/services";
import type { SignalCallback } from "../core/types";
import { Batcher } from "./Batcher";
import { noCompressor, rleCompressor } from "./Compressor";
import type { Compressor, RemoteSignalOptions } from "./types";
const IS_SERVER = RunService.IsServer();
const REMOTE_ROOT_NAME = "Omeganet_Remotes";
function getRemoteRoot(): Folder {
	let folder = ReplicatedStorage.FindFirstChild(REMOTE_ROOT_NAME);
	if (folder === undefined) {
		if (IS_SERVER) {
			const created = new Instance("Folder");
			created.Name = REMOTE_ROOT_NAME;
			created.Parent = ReplicatedStorage;
			folder = created;
		} else {
			folder = ReplicatedStorage.WaitForChild(REMOTE_ROOT_NAME, 10);
			if (folder === undefined) {
				throw `[Omeganet] remote root "${REMOTE_ROOT_NAME}" missing after 10s`;
			}
		}
	}
	if (!folder.IsA("Folder")) {
		throw `[Omeganet] remote root exists but is not a Folder`;
	}
	return folder;
}
function resolveCompressor(option: RemoteSignalOptions<SignalCallback>["compression"]): Compressor {
	if (option === undefined || option === "none") return noCompressor;
	if (option === "rle") return rleCompressor;
	return option;
}
function ensureRemote(
	root: Folder,
	name: string,
	reliability: "reliable" | "unreliable",
): RemoteEvent | UnreliableRemoteEvent {
	const existing = root.FindFirstChild(name);
	if (existing !== undefined) {
		if (reliability === "reliable" && existing.IsA("RemoteEvent")) return existing;
		if (reliability === "unreliable" && existing.IsA("UnreliableRemoteEvent")) return existing;
		existing.Destroy();
	}
	if (!IS_SERVER) {
		const waited = root.WaitForChild(name, 10);
		if (waited === undefined) throw `[Omeganet] remote "${name}" not replicated within 10s`;
		if (waited.IsA("RemoteEvent") || waited.IsA("UnreliableRemoteEvent")) return waited;
		throw `[Omeganet] remote "${name}" is wrong class: ${waited.ClassName}`;
	}
	const created = new Instance(reliability === "reliable" ? "RemoteEvent" : "UnreliableRemoteEvent");
	created.Name = name;
	created.Parent = root;
	return created;
}
export class RemoteSignal<T extends SignalCallback> {
	public readonly name: string;
	private readonly remote: RemoteEvent | UnreliableRemoteEvent;
	private readonly compressor: Compressor;
	private readonly serverBatcher: Batcher<Parameters<T>> | undefined;
	private readonly clientBatcher: Map<Player, Batcher<Parameters<T>>> | undefined;
	private destroyed = false;
	private readonly connections = new Set<RBXScriptConnection>();
	constructor(private readonly options: RemoteSignalOptions<T>) {
		this.name = options.name;
		const reliability = options.reliability ?? "reliable";
		this.remote = ensureRemote(getRemoteRoot(), options.name, reliability);
		this.compressor = resolveCompressor(options.compression);
		if (options.batch === true) {
			const win = options.batchWindow ?? 1 / 30;
			const max = options.batchMaxSize ?? 50;
			if (!IS_SERVER) {
				this.serverBatcher = new Batcher<Parameters<T>>((batch) => {
					const compressed = this.compressor.compress(batch);
					(this.remote as RemoteEvent).FireServer("__batch__", this.compressor.name, compressed);
				}, win, max);
			} else {
				this.clientBatcher = new Map();
			}
		}
	}
	public fireServer(...args: Parameters<T>): void {
		if (this.destroyed) return;
		assert(!IS_SERVER, `[Omeganet] fireServer called on server for "${this.name}"`);
		if (this.serverBatcher !== undefined) {
			this.serverBatcher.push(args);
			return;
		}
		(this.remote as RemoteEvent).FireServer(...(args as Array<unknown>));
	}
	public fireClient(player: Player, ...args: Parameters<T>): void {
		if (this.destroyed) return;
		assert(IS_SERVER, `[Omeganet] fireClient called on client for "${this.name}"`);
		const batchers = this.clientBatcher;
		if (batchers !== undefined) {
			let b = batchers.get(player);
			if (b === undefined) {
				b = new Batcher<Parameters<T>>((batch) => {
					const compressed = this.compressor.compress(batch);
					(this.remote as RemoteEvent).FireClient(
						player,
						"__batch__",
						this.compressor.name,
						compressed,
					);
				}, this.options.batchWindow ?? 1 / 30, this.options.batchMaxSize ?? 50);
				batchers.set(player, b);
			}
			b.push(args);
			return;
		}
		(this.remote as RemoteEvent).FireClient(player, ...(args as Array<unknown>));
	}
	public fireAllClients(...args: Parameters<T>): void {
		if (this.destroyed) return;
		assert(IS_SERVER, `[Omeganet] fireAllClients called on client for "${this.name}"`);
		if (this.clientBatcher !== undefined) {
			for (const player of Players.GetPlayers()) {
				this.fireClient(player, ...args);
			}
			return;
		}
		(this.remote as RemoteEvent).FireAllClients(...(args as Array<unknown>));
	}
	public fireFilteredClients(filter: (player: Player) => boolean, ...args: Parameters<T>): void {
		if (this.destroyed) return;
		assert(IS_SERVER, `[Omeganet] fireFilteredClients called on client`);
		for (const player of Players.GetPlayers()) {
			if (filter(player)) this.fireClient(player, ...args);
		}
	}
	public onServerEvent(handler: (player: Player, ...args: Parameters<T>) => void): () => void {
		assert(IS_SERVER, `[Omeganet] onServerEvent called on client`);
		const conn = (this.remote as RemoteEvent).OnServerEvent.Connect(
			(player: Player, ...raw: Array<unknown>) => {
				this.dispatchIncoming(raw, (args) => handler(player, ...(args as Parameters<T>)));
			},
		);
		this.connections.add(conn);
		return () => {
			conn.Disconnect();
			this.connections.delete(conn);
		};
	}
	public onClientEvent(handler: T): () => void {
		assert(!IS_SERVER, `[Omeganet] onClientEvent called on server`);
		const conn = (this.remote as RemoteEvent).OnClientEvent.Connect((...raw: Array<unknown>) => {
			this.dispatchIncoming(raw, (args) =>
				(handler as unknown as (...a: Array<unknown>) => void)(...(args as Array<unknown>)),
			);
		});
		this.connections.add(conn);
		return () => {
			conn.Disconnect();
			this.connections.delete(conn);
		};
	}
	public flush(): void {
		this.serverBatcher?.flush();
		if (this.clientBatcher !== undefined) {
			for (const [, b] of this.clientBatcher) b.flush();
		}
	}
	public destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.serverBatcher?.destroy();
		if (this.clientBatcher !== undefined) {
			for (const [, b] of this.clientBatcher) b.destroy();
			this.clientBatcher.clear();
		}
		for (const c of this.connections) c.Disconnect();
		this.connections.clear();
	}
	private dispatchIncoming(
		raw: Array<unknown>,
		call: (args: ReadonlyArray<unknown>) => void,
	): void {
		if (raw.size() >= 3 && raw[0] === "__batch__" && typeIs(raw[1], "string")) {
			const comp = raw[1] === "none" ? noCompressor : raw[1] === "rle" ? rleCompressor : this.compressor;
			const decompressed = comp.decompress(raw[2]);
			for (const entry of decompressed) {
				if (typeIs(entry, "table")) {
					call(entry as ReadonlyArray<unknown>);
				}
			}
			return;
		}
		call(raw);
	}
}
