export { Signal } from "./Signal";
export { Connection, asConnection } from "./Connection";
export { spawnWithPool, poolSize, clearPool } from "./ThreadPool";
export type {
	SignalConnection,
	ReadonlySignal,
	SignalCallback,
	SignalOptions,
	InferArgs,
	InferReturn,
} from "./types";