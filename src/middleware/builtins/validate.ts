import type { MiddlewareEntry, MiddlewareHandler } from "../types";

export type SchemaLike<T> = {
	parse(value: unknown): T;
	safeParse?(value: unknown): { success: true; data: T } | { success: false; error: unknown };
};

export type ValidateOptions<TArgs extends ReadonlyArray<unknown>> = {
	readonly schemas: { readonly [K in keyof TArgs]?: SchemaLike<TArgs[K]> };
	readonly strict?: boolean;
	readonly onInvalid?: (index: number, value: unknown, reason: unknown) => void;
};

export function validate<TArgs extends ReadonlyArray<unknown>>(
	options: ValidateOptions<TArgs>,
): MiddlewareEntry<TArgs> {
	const handler: MiddlewareHandler<TArgs> = (ctx, proceed) => {
		const args = ctx.getArgs() as ReadonlyArray<unknown>;
		for (let i = 0; i < args.size(); i++) {
			const schema = options.schemas[i];
			if (schema === undefined) continue;
			const value = args[i];
			if (schema.safeParse !== undefined) {
				const result = schema.safeParse(value);
				if (!result.success) {
					options.onInvalid?.(i, value, result.error);
					ctx.abort(`validation failed on arg ${i}`);
					return;
				}
			} else {
				const [success, reason] = pcall(() => schema.parse(value));
				if (!success) {
					options.onInvalid?.(i, value, reason);
					ctx.abort(`validation failed on arg ${i}: ${tostring(reason)}`);
					return;
				}
			}
		}
		proceed();
	};

	return { priority: 90, name: "validate", handler };
}
