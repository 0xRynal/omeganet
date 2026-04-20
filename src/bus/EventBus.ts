
import { Signal } from "../core/Signal";
import type { SignalConnection, SignalOptions } from "../core/types";
export type EventMap = Record<string, Array<unknown>>;
export type EventBusOptions = Omit<SignalOptions, "name">;
export type EventBus<Events extends EventMap> = {
	on<K extends keyof Events & string>(
		event: K,
		handler: (...args: Events[K]) => void,
	): SignalConnection;
	once<K extends keyof Events & string>(
		event: K,
		handler: (...args: Events[K]) => void,
	): SignalConnection;
	off<K extends keyof Events & string>(event?: K): void;
	emit<K extends keyof Events & string>(event: K, ...args: Events[K]): void;
	wait<K extends keyof Events & string>(event: K, timeout?: number): LuaTuple<Events[K]>;
	listenerCount<K extends keyof Events & string>(event: K): number;
	clear(): void;
};
export function createEventBus<Events extends EventMap>(
	options: EventBusOptions = {},
): EventBus<Events> {
	const signals = new Map<string, Signal<(...args: Array<never>) => void>>();
	function getOrCreate(event: string): Signal<(...args: Array<never>) => void> {
		let s = signals.get(event);
		if (s === undefined) {
			s = new Signal({ name: `bus:${event}`, ...options });
			signals.set(event, s);
		}
		return s;
	}
	return {
		on(event, handler) {
			return getOrCreate(event).connect(handler as never);
		},
		once(event, handler) {
			return getOrCreate(event).once(handler as never);
		},
		off(event) {
			if (event === undefined) {
				for (const [, s] of signals) s.destroy();
				signals.clear();
				return;
			}
			const s = signals.get(event);
			if (s !== undefined) {
				s.disconnectAll();
			}
		},
		emit(event, ...args) {
			const s = signals.get(event);
			if (s === undefined) return;
			(s as unknown as { fire(...a: Array<unknown>): void }).fire(...(args as Array<unknown>));
		},
		wait<K extends keyof Events & string>(event: K, timeout?: number): LuaTuple<Events[K]> {
			return getOrCreate(event).wait(timeout) as unknown as LuaTuple<Events[K]>;
		},
		listenerCount(event) {
			const s = signals.get(event);
			return s !== undefined ? s.getConnectionCount() : 0;
		},
		clear() {
			for (const [, s] of signals) s.destroy();
			signals.clear();
		},
	};
}
