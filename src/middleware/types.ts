export type MiddlewareContext<TArgs extends ReadonlyArray<unknown> = ReadonlyArray<unknown>> = {
	readonly signalName: string;
	readonly args: TArgs;
	readonly sender?: Player;
	readonly timestamp: number;
	readonly metadata: Map<string, unknown>;
	abort(reason?: string): void;
	replace(newArgs: TArgs): void;
	isAborted(): boolean;
	getAbortReason(): string | undefined;
	getArgs(): TArgs;
};

export type MiddlewareHandler<TArgs extends ReadonlyArray<unknown> = ReadonlyArray<unknown>> = (
	ctx: MiddlewareContext<TArgs>,
	proceed: () => void,
) => void | Promise<void>;

export type MiddlewareEntry<TArgs extends ReadonlyArray<unknown> = ReadonlyArray<unknown>> = {
	readonly priority: number;
	readonly name: string;
	readonly handler: MiddlewareHandler<TArgs>;
};
