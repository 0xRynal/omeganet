import type { ObservableLike, Observer, Operator, Subscriber, Subscription, Teardown } from "./types";
function normalizeObserver<T>(o: Partial<Observer<T>> | ((value: T) => void)): Observer<T> {
	if (typeIs(o, "function")) {
		return { next: o };
	}
	const out: { next: (value: T) => void; error?: (e: unknown) => void; complete?: () => void } = {
		next: o.next ?? ((_: T) => {}),
	};
	if (o.error !== undefined) out.error = o.error;
	if (o.complete !== undefined) out.complete = o.complete;
	return out;
}
class SubscriptionImpl implements Subscription {
	public closed = false;
	constructor(private readonly teardownFn: () => void) {}
	public unsubscribe = (): void => {
		if (this.closed) return;
		this.closed = true;
		this.teardownFn();
	};
}
export class Observable<T> implements ObservableLike<T> {
	public readonly subscribe: ObservableLike<T>["subscribe"];
	public readonly pipe: ObservableLike<T>["pipe"];
	constructor(private readonly producer: Subscriber<T>) {
		this.subscribe = (input) => this.doSubscribe(input);
		this.pipe = ((...operators: Array<Operator<unknown, unknown>>) => {
			let current: ObservableLike<unknown> = this as unknown as ObservableLike<unknown>;
			for (const op of operators) current = op(current);
			return current;
		}) as ObservableLike<T>["pipe"];
	}
	private doSubscribe(input: Partial<Observer<T>> | ((value: T) => void)): Subscription {
		const observer = normalizeObserver<T>(input);
		const state = { closed: false };
		let teardown: Teardown | undefined;
		const safeNext = (value: T) => {
			if (state.closed) return;
			observer.next(value);
		};
		const safeError = (err: unknown) => {
			if (state.closed) return;
			state.closed = true;
			observer.error?.(err);
			teardown?.();
		};
		const safeComplete = () => {
			if (state.closed) return;
			state.closed = true;
			observer.complete?.();
			teardown?.();
		};
		const safe: Observer<T> = {
			next: safeNext,
			error: safeError,
			complete: safeComplete,
		};
		const result = this.producer(safe);
		if (typeIs(result, "function")) teardown = result;
		return new SubscriptionImpl(() => {
			state.closed = true;
			teardown?.();
		});
	}
}
export function of<T>(...values: Array<T>): Observable<T> {
	return new Observable<T>((observer) => {
		for (const v of values) observer.next(v);
		observer.complete?.();
	});
}
export function fromArray<T>(values: ReadonlyArray<T>): Observable<T> {
	return new Observable<T>((observer) => {
		for (const v of values) observer.next(v);
		observer.complete?.();
	});
}
export function interval(periodSeconds: number): Observable<number> {
	return new Observable<number>((observer) => {
		let count = 0;
		let alive = true;
		task.spawn(() => {
			while (alive) {
				task.wait(periodSeconds);
				if (!alive) break;
				observer.next(count++);
			}
		});
		return () => {
			alive = false;
		};
	});
}
export function fromSignal<T>(signal: {
	connect: (handler: (value: T) => void) => { disconnect: () => void };
}): Observable<T> {
	return new Observable<T>((observer) => {
		const conn = signal.connect((v) => observer.next(v));
		return () => conn.disconnect();
	});
}