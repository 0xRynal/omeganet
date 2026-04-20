import type { SignalCallback } from "../core/types";
import type { SchemaLike } from "../middleware/builtins/validate";

export type Reliability = "reliable" | "unreliable";

export type Compressor = {
	readonly name: string;
	compress(payload: ReadonlyArray<unknown>): unknown;
	decompress(payload: unknown): ReadonlyArray<unknown>;
};

export type CompressorOption = "none" | "rle" | Compressor;

export type RemoteSignalOptions<T extends SignalCallback> = {
	readonly name: string;
	readonly reliability?: Reliability;
	readonly batch?: boolean;
	readonly batchWindow?: number;
	readonly batchMaxSize?: number;
	readonly compression?: CompressorOption;
	readonly schema?: { readonly [K in keyof Parameters<T>]?: SchemaLike<Parameters<T>[K]> };
	readonly validateOnClient?: boolean;
};
