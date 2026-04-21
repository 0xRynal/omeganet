import { RunService } from "@rbxts/services";
import { Signal } from "../core/Signal";
import type { SignalCallback } from "../core/types";
import { MiddlewareChain } from "../middleware/MiddlewareChain";
import type { MiddlewareEntry, MiddlewareHandler } from "../middleware/types";
import { RemoteSignal } from "../remote/RemoteSignal";
import { ActorPool } from "../parallel/ActorPool";
import { fromSignal } from "../reactive/Observable";
import type { ObservableLike } from "../reactive/types";
import type { OmegaCreateOptions, OmegaMode, OmegaSignal } from "./types";
import { Collector } from "../devtools/Collector";
import { HeuristicAnalyzer, type HeuristicRuntime } from "../algo/Analyzer";

const IS_SERVER = RunService.IsServer();

function resolveMode<T extends SignalCallback>(options: OmegaCreateOptions<T>): OmegaMode {
	const requested = options.mode ?? "auto";
	if (requested !== "auto") return requested;
	if (options.parallel === true) return "parallel";
	return "local";
}

class OmegaSignalImpl<T extends SignalCallback> implements OmegaSignal<T> {
	public readonly name: string;
	public readonly mode: OmegaMode;
	private readonly local: Signal<T>;
	private readonly remote: RemoteSignal<T> | undefined;
	private readonly pool: ActorPool | undefined;
	private readonly chain = new MiddlewareChain<Parameters<T>>();
	private destroyed = false;

	constructor(options: OmegaCreateOptions<T>) {
		this.name = options.name;
		this.mode = resolveMode(options);
		this.local = new Signal<T>({ name: options.name });
		if (this.mode === "remote") {
			this.remote = new RemoteSignal<T>({
				name: options.name,
				reliability: options.reliability ?? "reliable",
				...(options.batch !== undefined ? { batch: options.batch } : {}),
				...(options.batchWindow !== undefined ? { batchWindow: options.batchWindow } : {}),
				...(options.batchMaxSize !== undefined ? { batchMaxSize: options.batchMaxSize } : {}),
				...(options.compression !== undefined ? { compression: options.compression } : {}),
				...(options.schema !== undefined ? { schema: options.schema } : {}),
			});
			if (IS_SERVER) {
				this.remote.onServerEvent((player, ...args) => {
					this.runThroughMiddleware(args, player);
				});
			} else {
				this.remote.onClientEvent(((...args: Array<unknown>) => {
					this.runThroughMiddleware(args as Parameters<T>);
				}) as unknown as T);
			}
		}
		if (this.mode === "parallel") {
			this.pool = new ActorPool({
				name: options.name,
				...(options.parallelPoolSize !== undefined ? { size: options.parallelPoolSize } : {}),
			});
		}
		Collector.trackSignal(this.name, this.mode);
	}

	public connect(handler: T) {
		return this.local.connect(handler);
	}
	public once(handler: T) {
		return this.local.once(handler);
	}
	public fire(...args: Parameters<T>): void {
		if (this.destroyed) return;
		if (this.mode === "remote" && !IS_SERVER && this.remote !== undefined) {
			this.remote.fireServer(...args);
			return;
		}
		this.runThroughMiddleware(args);
	}
	public fireClient(player: Player, ...args: Parameters<T>): void {
		if (this.destroyed || this.remote === undefined) return;
		assert(IS_SERVER, `[Omeganet] fireClient on client for "${this.name}"`);
		this.remote.fireClient(player, ...args);
	}
	public fireAllClients(...args: Parameters<T>): void {
		if (this.destroyed || this.remote === undefined) return;
		assert(IS_SERVER, `[Omeganet] fireAllClients on client for "${this.name}"`);
		this.remote.fireAllClients(...args);
	}
	public fireParallel(...args: Parameters<T>): void {
		if (this.destroyed) return;
		if (this.pool === undefined) {
			warn(`[Omeganet] fireParallel called but no Actor pool for "${this.name}"`);
			this.fire(...args);
			return;
		}
		this.pool.send("omeganet_fire", this.name, ...(args as Array<unknown>));
	}
	public use(mw: MiddlewareEntry | MiddlewareHandler): OmegaSignal<T> {
		this.chain.use(
			mw as unknown as MiddlewareEntry<Parameters<T>> | MiddlewareHandler<Parameters<T>>,
		);
		return this;
	}
	public asObservable(): ObservableLike<Parameters<T>> {
		return fromSignal<Parameters<T>>({
			connect: (handler) => {
				const conn = this.local.connect(((...args: Array<unknown>) =>
					handler(args as Parameters<T>)) as unknown as T);
				return { disconnect: () => conn.disconnect() };
			},
		});
	}
	public flush(): void {
		this.remote?.flush();
	}
	public destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.local.destroy();
		this.remote?.destroy();
		this.pool?.destroy();
		this.chain.clear();
		Collector.untrackSignal(this.name);
	}
	private runThroughMiddleware(args: Parameters<T>, sender?: Player): void {
		if (this.chain.size() === 0) {
			this.local.fire(...args);
			Collector.recordFire(this.name, args.size());
			return;
		}
		const ctx = this.chain.executeSync(args, this.name, sender);
		if (!ctx.isAborted()) {
			this.local.fire(...(ctx.getArgs()));
			Collector.recordFire(this.name, args.size());
		} else {
			Collector.recordAbort(this.name, ctx.getAbortReason());
		}
	}
}

function createSignal<T extends SignalCallback>(options: OmegaCreateOptions<T>): OmegaSignal<T> {
	return new OmegaSignalImpl<T>(options);
}

interface OmegaNamespace {
	readonly create: <T extends SignalCallback>(options: OmegaCreateOptions<T>) => OmegaSignal<T>;
	readonly algo: HeuristicRuntime;
}

const namespace: OmegaNamespace = {
	create: createSignal,
	algo: HeuristicAnalyzer,
};

export const Omeganet = {
	Omega: namespace,
};
