
export type Brand<T, TName extends string> = T & { readonly __brand: TName };
export type SignalName = Brand<string, "SignalName">;
export type PoolName = Brand<string, "PoolName">;
export type StateName = Brand<string, "StateName">;
export type RuleId = Brand<string, "RuleId">;
export function asSignalName(value: string): SignalName {
	return value as SignalName;
}
export function asPoolName(value: string): PoolName {
	return value as PoolName;
}
export function asStateName(value: string): StateName {
	return value as StateName;
}
export function asRuleId(value: string): RuleId {
	return value as RuleId;
}