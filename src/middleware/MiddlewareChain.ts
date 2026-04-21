import type { MiddlewareContext, MiddlewareEntry, MiddlewareHandler } from "./types";
class Context<TArgs extends ReadonlyArray<unknown>> implements MiddlewareContext<TArgs> {
	public readonly signalName: string;
	public readonly timestamp: number;
	public readonly metadata = new Map<string, unknown>();
	public readonly sender?: Player;
	public args: TArgs;
	private aborted = false;
	private abortReason: string | undefined;
	constructor(args: TArgs, signalName: string, sender: Player | undefined) {
		this.args = args;
		this.signalName = signalName;
		this.timestamp = os.clock();
		if (sender !== undefined) this.sender = sender;
	}
	public abort(reason?: string): void {
		this.aborted = true;
		this.abortReason = reason;
	}
	public replace(newArgs: TArgs): void {
		this.args = newArgs;
	}
	public isAborted(): boolean {
		return this.aborted;
	}
	public getAbortReason(): string | undefined {
		return this.abortReason;
	}
	public getArgs(): TArgs {
		return this.args;
	}
}
function createContext<TArgs extends ReadonlyArray<unknown>>(
	args: TArgs,
	signalName: string,
	sender: Player | undefined,
): MiddlewareContext<TArgs> {
	return new Context(args, signalName, sender);
}
export class MiddlewareChain<TArgs extends ReadonlyArray<unknown> = ReadonlyArray<unknown>> {
	private entries: Array<MiddlewareEntry<TArgs>> = [];
	private counter = 0;
	public use(entry: MiddlewareEntry<TArgs> | MiddlewareHandler<TArgs>): this {
		const normalized: MiddlewareEntry<TArgs> = typeIs(entry, "function")
			? { priority: 0, name: `anonymous_${this.counter++}`, handler: entry }
			: entry;
		this.entries.push(normalized);
		this.entries.sort((a, b) => a.priority > b.priority);
		return this;
	}
	public remove(name: string): boolean {
		const before = this.entries.size();
		this.entries = this.entries.filter((e) => e.name !== name);
		return this.entries.size() < before;
	}
	public size(): number {
		return this.entries.size();
	}
	public clear(): void {
		this.entries = [];
	}
	public async execute(
		args: TArgs,
		signalName: string,
		sender?: Player,
	): Promise<MiddlewareContext<TArgs>> {
		const ctx = createContext(args, signalName, sender);
		const entries = this.entries;
		let index = -1;
		const runNext = async (i: number): Promise<void> => {
			if (ctx.isAborted()) return;
			if (i <= index) {
				throw `[Omeganet] proceed() called multiple times in middleware "${entries[i]?.name ?? "?"}"`;
			}
			index = i;
			const entry = entries[i];
			if (entry === undefined) return;
			let nextCalled = false;
			const proceed = () => {
				if (nextCalled) return;
				nextCalled = true;
				void runNext(i + 1);
			};
			const result = entry.handler(ctx, proceed);
			if (Promise.is(result)) {
				await result;
			}
		};
		await runNext(0);
		return ctx;
	}
	public executeSync(
		args: TArgs,
		signalName: string,
		sender?: Player,
	): MiddlewareContext<TArgs> {
		const ctx = createContext(args, signalName, sender);
		const entries = this.entries;
		let index = -1;
		const runNext = (i: number): void => {
			if (ctx.isAborted()) return;
			if (i <= index) {
				throw `[Omeganet] proceed() called multiple times in middleware "${entries[i]?.name ?? "?"}"`;
			}
			index = i;
			const entry = entries[i];
			if (entry === undefined) return;
			let nextCalled = false;
			const proceed = () => {
				if (nextCalled) return;
				nextCalled = true;
				runNext(i + 1);
			};
			const result = entry.handler(ctx, proceed);
			if (Promise.is(result)) {
				warn(
					`[Omeganet] Middleware "${entry.name}" returned a Promise in executeSync — use execute() instead`,
				);
			}
		};
		runNext(0);
		return ctx;
	}
}
