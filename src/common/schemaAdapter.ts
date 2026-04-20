import type { SchemaLike } from "../middleware/builtins/validate";
import { err, ok, toError } from "./Result";
import type { Result } from "./Result";
import type { SignalXError } from "./Result";

export function safeParseToResult<T>(
	schema: SchemaLike<T>,
	value: unknown,
): Result<T, SignalXError> {
	if (schema.safeParse !== undefined) {
		const r = schema.safeParse(value);
		return r.success ? ok(r.data) : err(toError(r.error, "SCHEMA_INVALID"));
	}
	const [success, result] = pcall(() => schema.parse(value));
	return success ? ok(result) : err(toError(result, "SCHEMA_INVALID"));
}
