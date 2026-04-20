
import { Signal } from "../core/Signal";
import type { SignalCallback, SignalConnection, SignalOptions } from "../core/types";
import type { Subscription, Teardown } from "../reactive/types";
export type Disposable =
	| SignalConnection
	| Subscription
	| RBXScriptConnection
	| Teardown
	| { destroy(): void }
	| { dispose(): void };
function isTeardown(v: Disposable): v is Teardown {
	return typeIs(v, "function");
}
function isSignalConnection(v: Disposable): v is SignalConnection {
	if (!typeIs(v, "table") || !("disconnect" in v)) return false;
	const t = v as { disconnect?: unknown };
	return typeIs(t.disconnect, "function");
}
function isSubscription(v: Disposable): v is Subscription {
	if (!typeIs(v, "table") || !("unsubscribe" in v)) return false;
	const t = v as { unsubscribe?: unknown };
	return typeIs(t.unsubscribe, "function");
}
function isRbxConnection(v: Disposable): v is RBXScriptConnection {
	return typeIs(v, "RBXScriptConnection");
}
function isDestroyable(v: Disposable): v is { destroy(): void } {
	return typeIs(v, "table") && "destroy" in v && typeIs((v as { destroy: unknown }).destroy, "function");
}
function isDisposable(v: Disposable): v is { dispose(): void } {
	return typeIs(v, "table") && "dispose" in v && typeIs((v as { dispose: unknown }).dispose, "function");
}
function runOne(d: Disposable): void {
	const [ok, err] = pcall(() => {
		if (isTeardown(d)) d();
		else if (isRbxConnection(d)) d.Disconnect();
		else if (isSignalConnection(d)) d.disconnect();
		else if (isSubscription(d)) d.unsubscribe();
		else if (isDisposable(d)) d.dispose();
		else if (isDestroyable(d)) d.destroy();
	});
	if (!ok) warn(`[SignalX/Scope] teardown error: ${err}`);
}
export type Scope = {
	signal<T extends SignalCallback>(options?: SignalOptions): Signal<T>;
	track<D extends Disposable>(disposable: D): D;
	trackAll<D extends Disposable>(disposables: ReadonlyArray<D>): ReadonlyArray<D>;
	dispose(): void;
	isDisposed(): boolean;
	size(): number;
	child(): Scope;
};
export function createScope(): Scope {
	const tracked: Array<Disposable> = [];
	let disposed = false;
	function track<D extends Disposable>(d: D): D {
		if (disposed) {
			runOne(d);
			return d;
		}
		tracked.push(d);
		return d;
	}
	const scope: Scope = {
		signal<T extends SignalCallback>(options?: SignalOptions): Signal<T> {
			assert(!disposed, "[SignalX/Scope] cannot allocate on a disposed scope");
			const s = new Signal<T>(options);
			track(s);
			return s;
		},
		track(d) {
			return track(d);
		},
		trackAll(list) {
			for (const d of list) track(d);
			return list;
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			for (let i = tracked.size() - 1; i >= 0; i--) {
				const d = tracked[i];
				if (d !== undefined) runOne(d);
			}
			tracked.clear();
		},
		isDisposed() {
			return disposed;
		},
		size() {
			return tracked.size();
		},
		child() {
			const c = createScope();
			track(c);
			return c;
		},
	};
	return scope;
}
