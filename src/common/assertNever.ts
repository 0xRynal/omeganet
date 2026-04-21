
export function assertNever(value: never, context = "switch"): never {
	throw `[Omeganet/assertNever] unhandled variant in ${context}: ${tostring(value)}`;
}
