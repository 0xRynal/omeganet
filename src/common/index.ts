export {
	type Brand,
	type SignalName,
	type PoolName,
	type StateName,
	type RuleId,
	asSignalName,
	asPoolName,
	asStateName,
	asRuleId,
} from "./branded";

export {
	type Result,
	SignalXError,
	ok,
	err,
	isOk,
	isErr,
	unwrap,
	unwrapOr,
	map as mapResult,
	mapErr,
	toError,
} from "./Result";

export { assertNever } from "./assertNever";
export { safeParseToResult } from "./schemaAdapter";
