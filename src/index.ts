export { Omeganet } from "./omega/Omeganet";
export type { OmegaCreateOptions, OmegaMode, OmegaSignal } from "./omega/types";

export { Signal } from "./core/Signal";
export { Connection, asConnection } from "./core/Connection";
export { spawnWithPool, poolSize, clearPool } from "./core/ThreadPool";
export type {
	SignalConnection,
	ReadonlySignal,
	SignalCallback,
	SignalOptions,
	InferArgs,
	InferReturn,
} from "./core/types";

export { createEventBus } from "./bus/EventBus";
export type { EventBus, EventMap, EventBusOptions } from "./bus/EventBus";

export { createScope } from "./scope/Scope";
export type { Scope, Disposable } from "./scope/Scope";

import { Signal as _SignalCls } from "./core/Signal";
import type { SignalCallback as _SigCb, SignalOptions as _SigOpts } from "./core/types";

export function signal<T extends _SigCb>(options?: _SigOpts): _SignalCls<T> {
	return new _SignalCls<T>(options);
}

export { MiddlewareChain } from "./middleware/MiddlewareChain";
export * from "./middleware/builtins";
export type { MiddlewareContext, MiddlewareEntry, MiddlewareHandler } from "./middleware/types";

export { RemoteSignal } from "./remote/RemoteSignal";
export { RemoteFunctionX } from "./remote/RemoteFunction";
export { Reconciler } from "./remote/Reconciler";
export { rleCompressor, noCompressor } from "./remote/Compressor";
export { S as schema } from "./remote/Validator";
export type {
	RemoteSignalOptions,
	Reliability,
	Compressor,
	CompressorOption,
} from "./remote/types";

export { ActorPool } from "./parallel/ActorPool";
export { SharedState } from "./parallel/SharedState";
export { RaceDetector } from "./parallel/RaceDetector";
export type { ActorPoolOptions, SharedStateOptions, Unsubscribe } from "./parallel/types";

export { Observable, of, fromArray, fromSignal, interval } from "./reactive/Observable";
export { Subject, BehaviorSubject } from "./reactive/Subject";
export {
	map,
	filter,
	take,
	takeUntil,
	debounce as debounceOp,
	throttle as throttleOp,
	distinctUntilChanged,
	startWith,
	switchMap,
	merge,
	combineLatest,
	tap,
} from "./reactive/operators";
export { createSignalValue, createSignalEffect } from "./reactive/hooks";
export type {
	ObservableLike,
	Observer,
	Operator,
	Subscriber,
	Subscription,
	Teardown,
} from "./reactive/types";

export { HeuristicAnalyzer, type HintProvider, type HeuristicRuntime } from "./algo/Analyzer";
export { defaultRules, type Rule } from "./algo/rules";
export type { Suggestion, SuggestionSeverity } from "./algo/Suggestion";

export { Collector, DevToolsStream, mountStudioPanel } from "./devtools";
export type { SignalStats, DevToolsEvent, StudioPanelHandle } from "./devtools";

export { MockSignal, simulate, takeSnapshot, serialize, assertMatches } from "./testing";
export type { SimulatorOptions, SimulationReport, Snapshot } from "./testing";

export {
	OmeganetError,
	ok,
	err,
	isOk,
	isErr,
	unwrap,
	unwrapOr,
	mapResult,
	mapErr,
	toError,
	assertNever,
	asSignalName,
	asPoolName,
	asStateName,
	asRuleId,
	safeParseToResult,
} from "./common";
export type {
	Result,
	Brand,
	SignalName,
	PoolName,
	StateName,
	RuleId,
} from "./common";
