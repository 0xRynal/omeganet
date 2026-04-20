import type { SchemaLike } from "../middleware/builtins/validate";
function ok<T>(data: T) {
	return { success: true as const, data };
}
function fail(reason: string) {
	return { success: false as const, error: reason };
}
export const S = {
	number: (min?: number, max?: number): SchemaLike<number> => ({
		parse(value: unknown): number {
			if (!typeIs(value, "number")) throw `expected number, got ${typeOf(value)}`;
			if (min !== undefined && value < min) throw `number < ${min}`;
			if (max !== undefined && value > max) throw `number > ${max}`;
			return value;
		},
		safeParse(value: unknown) {
			if (!typeIs(value, "number")) return fail(`expected number, got ${typeOf(value)}`);
			if (min !== undefined && value < min) return fail(`number < ${min}`);
			if (max !== undefined && value > max) return fail(`number > ${max}`);
			return ok(value);
		},
	}),
	string: (maxLen?: number): SchemaLike<string> => ({
		parse(value: unknown): string {
			if (!typeIs(value, "string")) throw `expected string, got ${typeOf(value)}`;
			if (maxLen !== undefined && value.size() > maxLen) throw `string too long`;
			return value;
		},
		safeParse(value: unknown) {
			if (!typeIs(value, "string")) return fail(`expected string, got ${typeOf(value)}`);
			if (maxLen !== undefined && value.size() > maxLen) return fail(`string too long`);
			return ok(value);
		},
	}),
	boolean: (): SchemaLike<boolean> => ({
		parse(value: unknown): boolean {
			if (!typeIs(value, "boolean")) throw `expected boolean, got ${typeOf(value)}`;
			return value;
		},
		safeParse(value: unknown) {
			return typeIs(value, "boolean") ? ok(value) : fail(`expected boolean, got ${typeOf(value)}`);
		},
	}),
	instanceOf: <T extends keyof Instances>(className: T): SchemaLike<Instances[T]> => ({
		parse(value: unknown): Instances[T] {
			if (!typeIs(value, "Instance")) throw `expected Instance, got ${typeOf(value)}`;
			if (!value.IsA(className)) throw `expected ${className}, got ${value.ClassName}`;
			return value as Instances[T];
		},
		safeParse(value: unknown) {
			if (!typeIs(value, "Instance")) return fail(`expected Instance, got ${typeOf(value)}`);
			if (!value.IsA(className)) return fail(`expected ${className}, got ${value.ClassName}`);
			return ok(value as Instances[T]);
		},
	}),
	player: (): SchemaLike<Player> => S.instanceOf("Player"),
	vector3: (): SchemaLike<Vector3> => ({
		parse(value: unknown): Vector3 {
			if (!typeIs(value, "Vector3")) throw `expected Vector3, got ${typeOf(value)}`;
			return value;
		},
		safeParse(value: unknown) {
			return typeIs(value, "Vector3") ? ok(value) : fail(`expected Vector3, got ${typeOf(value)}`);
		},
	}),
};