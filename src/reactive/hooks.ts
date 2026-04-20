import type { ObservableLike } from "./types";
import { BehaviorSubject } from "./Subject";
export type SignalValueBinding<T> = {
	readonly get: () => T;
	readonly subscribe: (listener: (value: T) => void) => () => void;
};
export function createSignalValue<T>(initial: T, source: ObservableLike<T>): SignalValueBinding<T> {
	const state = new BehaviorSubject(initial);
	source.subscribe((v) => state.next(v));
	const get = (): T => state.getValue();
	const subscribe = (listener: (value: T) => void): (() => void) => {
		const sub = state.subscribe((v) => listener(v));
		return () => sub.unsubscribe();
	};
	return { get, subscribe };
}
export function createSignalEffect(
	source: ObservableLike<unknown>,
	effect: (value: unknown) => void,
): () => void {
	const sub = source.subscribe((v) => effect(v));
	return () => sub.unsubscribe();
}