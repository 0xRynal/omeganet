import { Observable } from "./Observable";
import type { Observer } from "./types";
export class Subject<T> extends Observable<T> {
	private observers: Array<Observer<T>> = [];
	private closedState = false;
	constructor() {
		super((observer) => {
			if (this.closedState) {
				observer.complete?.();
				return () => {};
			}
			this.observers.push(observer);
			return () => {
				const idx = this.observers.indexOf(observer);
				if (idx >= 0) this.observers.remove(idx);
			};
		});
	}
	public next(value: T): void {
		if (this.closedState) return;
		const snapshot = [...this.observers];
		for (const o of snapshot) o.next(value);
	}
	public error(err: unknown): void {
		if (this.closedState) return;
		this.closedState = true;
		for (const o of this.observers) o.error?.(err);
		this.observers.clear();
	}
	public complete(): void {
		if (this.closedState) return;
		this.closedState = true;
		for (const o of this.observers) o.complete?.();
		this.observers.clear();
	}
	public observerCount(): number {
		return this.observers.size();
	}
}
export class BehaviorSubject<T> extends Subject<T> {
	constructor(private current: T) {
		super();
	}
	public getValue(): T {
		return this.current;
	}
	public override next(value: T): void {
		this.current = value;
		super.next(value);
	}
}