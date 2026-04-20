import { ReplicatedStorage, RunService } from "@rbxts/services";

const IS_SERVER = RunService.IsServer();
const ROOT_NAME = "SignalX_RemoteFunctions";

function getRoot(): Folder {
	let folder = ReplicatedStorage.FindFirstChild(ROOT_NAME);
	if (folder === undefined) {
		if (IS_SERVER) {
			const created = new Instance("Folder");
			created.Name = ROOT_NAME;
			created.Parent = ReplicatedStorage;
			folder = created;
		} else {
			folder = ReplicatedStorage.WaitForChild(ROOT_NAME, 10);
			if (folder === undefined) throw `[SignalX] RemoteFunction root missing`;
		}
	}
	if (!folder.IsA("Folder")) throw `[SignalX] RF root wrong class`;
	return folder;
}

function ensureRF(name: string): RemoteFunction {
	const root = getRoot();
	const existing = root.FindFirstChild(name);
	if (existing?.IsA("RemoteFunction") === true) return existing;
	existing?.Destroy();
	if (!IS_SERVER) {
		const waited = root.WaitForChild(name, 10);
		if (!waited?.IsA("RemoteFunction")) {
			throw `[SignalX] RemoteFunction "${name}" missing on client`;
		}
		return waited;
	}
	const rf = new Instance("RemoteFunction");
	rf.Name = name;
	rf.Parent = root;
	return rf;
}

export type RemoteFunctionOptions = {
	readonly name: string;
	readonly timeout?: number;
};

export class RemoteFunctionX<TArgs extends ReadonlyArray<unknown>, TReturn> {
	private readonly rf: RemoteFunction;
	public readonly name: string;
	private destroyed = false;

	constructor(private readonly options: RemoteFunctionOptions) {
		this.rf = ensureRF(options.name);
		this.name = options.name;
	}

	public invokeServer(...args: TArgs): TReturn {
		assert(!IS_SERVER, `[SignalX] invokeServer called on server`);
		return this.rf.InvokeServer(...(args as unknown as Array<unknown>)) as TReturn;
	}

	public invokeClient(player: Player, ...args: TArgs): TReturn {
		assert(IS_SERVER, `[SignalX] invokeClient called on client`);
		return this.rf.InvokeClient(player, ...(args as unknown as Array<unknown>)) as TReturn;
	}

	public setServerHandler(handler: (player: Player, ...args: TArgs) => TReturn): void {
		assert(IS_SERVER, `[SignalX] setServerHandler on client`);
		this.rf.OnServerInvoke = (player: Player, ...raw: Array<unknown>) =>
			handler(player, ...(raw as unknown as TArgs)) as unknown as void;
	}

	public setClientHandler(handler: (...args: TArgs) => TReturn): void {
		assert(!IS_SERVER, `[SignalX] setClientHandler on server`);
		this.rf.OnClientInvoke = (...raw: Array<unknown>) =>
			handler(...(raw as unknown as TArgs)) as unknown as void;
	}

	public destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
	}
}
