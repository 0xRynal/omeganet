
export function assertNever(value: never, context = "switch"): never {
	throw `[SignalX/assertNever] unhandled variant in ${context}: ${tostring(value)}`;
}