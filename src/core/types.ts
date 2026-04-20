export type SignalCallback = (...args: Array<never>) => unknown;
export type InferArgs<T extends SignalCallback> = Parameters<T>;
export type InferReturn<T extends SignalCallback> = ReturnType<T>;
export type SignalConnection = {
	readonly connected: boolean;
	disconnect(): void;
};
export type ReadonlySignal<T extends SignalCallback> = {
	connect(handler: T): SignalConnection;
	once(handler: T): SignalConnection;
	wait(timeout?: number): LuaTuple<InferArgs<T>>;
	getConnectionCount(): number;
};
export type SignalOptions = {
	readonly name?: string;
	readonly deferred?: boolean;
	readonly sync?: boolean;
	readonly unsafe?: boolean;
};