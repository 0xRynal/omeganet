import type { SignalCallback, SignalConnection } from "../core/types";
type MockEntry<T extends SignalCallback> = {
	readonly args: Parameters<T>;
	readonly timestamp: number;
};
type HandlerEntry<T extends SignalCallback> = {
	handler: T;
	once: boolean;
	connected: boolean;
};
class MockConnection<T extends SignalCallback> {
	public connected = true;
	constructor(private readonly entry: HandlerEntry<T>) {}
	public disconnect(): void {
		this.entry.connected = false;
		this.connected = false;
	}
}
export class MockSignal<T extends SignalCallback> {
	private handlers: Array<HandlerEntry<T>> = [];
	private readonly fires: Array<MockEntry<T>> = [];
	public readonly name: string;
	constructor(name = "MockSignal") {
		this.name = name;
	}
	public connect(handler: T): SignalConnection {
		const entry: HandlerEntry<T> = { handler, once: false, connected: true };
		this.handlers.push(entry);
		return new MockConnection(entry);
	}
	public once(handler: T): SignalConnection {
		const entry: HandlerEntry<T> = { handler, once: true, connected: true };
		this.handlers.push(entry);
		return new MockConnection(entry);
	}
	public wait(): LuaTuple<Parameters<T>> {
		error("[MockSignal] wait() not supported — use fireHistory() instead");
	}
	public fire(...args: Parameters<T>): void {
		this.fires.push({ args, timestamp: os.clock() });
		for (const entry of this.handlers) {
			if (!entry.connected) continue;
			(entry.handler as unknown as (...a: Array<unknown>) => void)(...(args as unknown as Array<unknown>));
			if (entry.once) entry.connected = false;
		}
	}
	public fireDeferred(...args: Parameters<T>): void {
		this.fire(...args);
	}
	public disconnectAll(): void {
		for (const e of this.handlers) e.connected = false;
		this.handlers = [];
	}
	public getConnectionCount(): number {
		let n = 0;
		for (const e of this.handlers) if (e.connected) n += 1;
		return n;
	}
	public destroy(): void {
		this.disconnectAll();
		this.fires.clear();
	}
	public fireHistory(): ReadonlyArray<MockEntry<T>> {
		return this.fires;
	}
	public fireCount(): number {
		return this.fires.size();
	}
	public lastFireArgs(): Parameters<T> | undefined {
		const last = this.fires[this.fires.size() - 1];
		return last?.args;
	}
	public reset(): void {
		this.fires.clear();
	}
}