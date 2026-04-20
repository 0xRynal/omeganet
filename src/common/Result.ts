
export type Result<T, E = SignalXError> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

export function err<E>(e: E): Result<never, E> {
	return { ok: false, error: e };
}

export function isOk<T, E>(result: Result<T, E>): result is { readonly ok: true; readonly value: T } {
	return result.ok;
}

export function isErr<T, E>(
	result: Result<T, E>,
): result is { readonly ok: false; readonly error: E } {
	return !result.ok;
}

export function unwrap<T, E>(result: Result<T, E>): T {
	assert(result.ok, `[SignalX/Result] unwrap() on error: ${tostring((result as { error: E }).error)}`);
	return result.value;
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
	return result.ok ? result.value : fallback;
}

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
	return result.ok ? ok(fn(result.value)) : result;
}

export function mapErr<T, E, F>(result: Result<T, E>, fn: (e: E) => F): Result<T, F> {
	return result.ok ? result : err(fn(result.error));
}

export class SignalXError {
	public readonly code: string;
	public readonly message: string;
	public readonly cause: unknown;

	constructor(code: string, message: string, cause?: unknown) {
		this.code = code;
		this.message = message;
		this.cause = cause;
	}

	public toString(): string {
		return `[${this.code}] ${this.message}`;
	}
}

export function toError(value: unknown, fallbackCode = "UNKNOWN"): SignalXError {
	if (value instanceof SignalXError) return value;
	if (typeIs(value, "string")) return new SignalXError(fallbackCode, value);
	if (typeIs(value, "table")) {
		const t = value as { code?: unknown; message?: unknown };
		const code = typeIs(t.code, "string") ? t.code : fallbackCode;
		const message = typeIs(t.message, "string") ? t.message : tostring(value);
		return new SignalXError(code, message, value);
	}
	return new SignalXError(fallbackCode, tostring(value), value);
}
