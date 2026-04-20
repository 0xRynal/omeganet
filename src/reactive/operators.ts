import { Observable } from "./Observable";
import type { ObservableLike, Operator } from "./types";
export function map<TIn, TOut>(project: (value: TIn, index: number) => TOut): Operator<TIn, TOut> {
	return (source) =>
		new Observable<TOut>((observer) => {
			let i = 0;
			const sub = source.subscribe({
				next: (v) => observer.next(project(v, i++)),
				error: (e) => observer.error?.(e),
				complete: () => observer.complete?.(),
			});
			return () => sub.unsubscribe();
		});
}
export function filter<T>(predicate: (value: T, index: number) => boolean): Operator<T, T> {
	return (source) =>
		new Observable<T>((observer) => {
			let i = 0;
			const sub = source.subscribe({
				next: (v) => {
					if (predicate(v, i++)) observer.next(v);
				},
				error: (e) => observer.error?.(e),
				complete: () => observer.complete?.(),
			});
			return () => sub.unsubscribe();
		});
}
export function take<T>(count: number): Operator<T, T> {
	return (source) =>
		new Observable<T>((observer) => {
			let emitted = 0;
			const sub = source.subscribe({
				next: (v) => {
					if (emitted < count) {
						observer.next(v);
						emitted += 1;
						if (emitted >= count) observer.complete?.();
					}
				},
				error: (e) => observer.error?.(e),
				complete: () => observer.complete?.(),
			});
			return () => sub.unsubscribe();
		});
}
export function takeUntil<T>(notifier: ObservableLike<unknown>): Operator<T, T> {
	return (source) =>
		new Observable<T>((observer) => {
			const n = notifier.subscribe(() => observer.complete?.());
			const s = source.subscribe({
				next: (v) => observer.next(v),
				error: (e) => observer.error?.(e),
				complete: () => observer.complete?.(),
			});
			return () => {
				s.unsubscribe();
				n.unsubscribe();
			};
		});
}
export function debounce<T>(delaySec: number): Operator<T, T> {
	return (source) =>
		new Observable<T>((observer) => {
			let timer: thread | undefined;
			const sub = source.subscribe({
				next: (v) => {
					if (timer !== undefined) task.cancel(timer);
					timer = task.delay(delaySec, () => {
						timer = undefined;
						observer.next(v);
					});
				},
				error: (e) => observer.error?.(e),
				complete: () => observer.complete?.(),
			});
			return () => {
				if (timer !== undefined) task.cancel(timer);
				sub.unsubscribe();
			};
		});
}
export function throttle<T>(intervalSec: number): Operator<T, T> {
	return (source) =>
		new Observable<T>((observer) => {
			let last = -math.huge;
			const sub = source.subscribe({
				next: (v) => {
					const now = os.clock();
					if (now - last >= intervalSec) {
						last = now;
						observer.next(v);
					}
				},
				error: (e) => observer.error?.(e),
				complete: () => observer.complete?.(),
			});
			return () => sub.unsubscribe();
		});
}
export function distinctUntilChanged<T>(
	equals: (a: T, b: T) => boolean = (a, b) => a === b,
): Operator<T, T> {
	return (source) =>
		new Observable<T>((observer) => {
			let has = false;
			let prev!: T;
			const sub = source.subscribe({
				next: (v) => {
					if (!has || !equals(prev, v)) {
						has = true;
						prev = v;
						observer.next(v);
					}
				},
				error: (e) => observer.error?.(e),
				complete: () => observer.complete?.(),
			});
			return () => sub.unsubscribe();
		});
}
export function startWith<T>(...values: Array<T>): Operator<T, T> {
	return (source) =>
		new Observable<T>((observer) => {
			for (const v of values) observer.next(v);
			const sub = source.subscribe({
				next: (v) => observer.next(v),
				error: (e) => observer.error?.(e),
				complete: () => observer.complete?.(),
			});
			return () => sub.unsubscribe();
		});
}
export function switchMap<TIn, TOut>(
	project: (value: TIn) => ObservableLike<TOut>,
): Operator<TIn, TOut> {
	return (source) =>
		new Observable<TOut>((observer) => {
			let inner: { unsubscribe(): void } | undefined;
			const outer = source.subscribe({
				next: (v) => {
					inner?.unsubscribe();
					inner = project(v).subscribe({
						next: (iv) => observer.next(iv),
						error: (e) => observer.error?.(e),
					});
				},
				error: (e) => observer.error?.(e),
				complete: () => observer.complete?.(),
			});
			return () => {
				outer.unsubscribe();
				inner?.unsubscribe();
			};
		});
}
export function merge<T>(...sources: Array<ObservableLike<T>>): ObservableLike<T> {
	return new Observable<T>((observer) => {
		const subs = sources.map((s) =>
			s.subscribe({
				next: (v) => observer.next(v),
				error: (e) => observer.error?.(e),
			}),
		);
		return () => {
			for (const s of subs) s.unsubscribe();
		};
	});
}
export function combineLatest<T extends ReadonlyArray<ObservableLike<unknown>>>(
	sources: T,
): ObservableLike<{ [K in keyof T]: T[K] extends ObservableLike<infer U> ? U : never }> {
	type Out = { [K in keyof T]: T[K] extends ObservableLike<infer U> ? U : never };
	return new Observable<Out>((observer) => {
		const n = sources.size();
		const values: Array<unknown> = [];
		const received = new Array<boolean>(n, false);
		let count = 0;
		const subs = sources.map((source, i) =>
			source.subscribe({
				next: (v) => {
					values[i] = v;
					if (!received[i]) {
						received[i] = true;
						count += 1;
					}
					if (count === n) observer.next(values as unknown as Out);
				},
				error: (e) => observer.error?.(e),
			}),
		);
		return () => {
			for (const s of subs) s.unsubscribe();
		};
	});
}
export function tap<T>(fn: (value: T) => void): Operator<T, T> {
	return (source) =>
		new Observable<T>((observer) => {
			const sub = source.subscribe({
				next: (v) => {
					fn(v);
					observer.next(v);
				},
				error: (e) => observer.error?.(e),
				complete: () => observer.complete?.(),
			});
			return () => sub.unsubscribe();
		});
}