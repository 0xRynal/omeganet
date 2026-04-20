import { Connection } from "./Connection";
import { spawnWithPool } from "./ThreadPool";
import type { InferArgs, SignalCallback, SignalConnection, SignalOptions } from "./types";
const DEAD_HANDLER: unknown = setmetatable({}, { __tostring: () => "[signalx:dead]" });
const DEAD_CONN: unknown = setmetatable({}, { __tostring: () => "[signalx:dead-conn]" });
export class Signal<T extends SignalCallback> {
	private count = 0;
	private destroyed = false;
	private readonly deferred: boolean;
	private readonly sync: boolean;
	private readonly unsafe: boolean;
	private readonly handlersArr: Array<T> = [];
	private readonly connsArr: Array<Connection<T>> = [];
	private holes = 0;
	private firingDepth = 0;
	private onceCount = 0;
	private hasOnce = false;
	public readonly name: string;
	constructor(options: SignalOptions = {}) {
		this.name = options.name ?? "AnonymousSignal";
		this.deferred = options.deferred ?? false;
		this.sync = options.sync ?? false;
		this.unsafe = options.unsafe ?? false;
	}
	public connect(handler: T): SignalConnection {
		assert(!this.destroyed, `[SignalX] Cannot connect to destroyed signal "${this.name}"`);
		return this.insert(handler, false);
	}
	public once(handler: T): SignalConnection {
		assert(!this.destroyed, `[SignalX] Cannot connect to destroyed signal "${this.name}"`);
		this.onceCount += 1;
		this.hasOnce = true;
		return this.insert(handler, true);
	}
	public wait(timeout?: number): LuaTuple<InferArgs<T>> {
		assert(!this.destroyed, `[SignalX] Cannot wait on destroyed signal "${this.name}"`);
		const current = coroutine.running();
		let resumed = false;
		let timeoutThread: thread | undefined;
		this.onceCount += 1;
		this.hasOnce = true;
		const conn = this.insert(((...args: Array<unknown>) => {
			if (resumed) return;
			resumed = true;
			if (timeoutThread !== undefined) {
				task.cancel(timeoutThread);
			}
			task.spawn(current, ...args);
		}) as unknown as T, true);
		if (timeout !== undefined && timeout > 0) {
			timeoutThread = task.delay(timeout, () => {
				if (resumed) return;
				resumed = true;
				conn.disconnect();
				task.spawn(current);
			});
		}
		return coroutine.yield() as LuaTuple<InferArgs<T>>;
	}
	public fire(...args: InferArgs<T>): void {
		if (this.destroyed) return;
		if (this.deferred) {
			this.fireDeferred(...args);
			return;
		}
		if (this.sync) {
			this.fireSync(...args);
			return;
		}
		const arr = this.handlersArr;
		const conns = this.connsArr;
		const n = arr.size();
		if (n === 0) return;
		const spread = args as unknown as Array<unknown>;
		this.firingDepth += 1;
		if (!this.hasOnce && this.holes === 0) {
			for (let i = 0; i < n; i++) {
				spawnWithPool(arr[i] as unknown as (...a: Array<unknown>) => unknown, ...spread);
			}
		} else {
			for (let i = 0; i < n; i++) {
				const h = arr[i] as unknown;
				if (h !== DEAD_HANDLER) {
					spawnWithPool(h as (...a: Array<unknown>) => unknown, ...spread);
					if (this.hasOnce) {
						const c = conns[i] as unknown;
						if (c !== DEAD_CONN && (c as Connection<T>).isOnce) (c as Connection<T>).disconnect();
					}
				}
			}
		}
		this.firingDepth -= 1;
		if (this.firingDepth === 0 && this.holes > 0) this.compactArr();
	}
	public fireSync(...args: InferArgs<T>): void {
		if (this.destroyed) return;
		const arr = this.handlersArr;
		const n = arr.size();
		if (n === 0) return;
		const spread = args as unknown as Array<unknown>;
		if (this.unsafe) {
			if (n === 1 && this.holes === 0 && !this.hasOnce) {
				(arr[0] as unknown as (...a: Array<unknown>) => unknown)(...spread);
				return;
			}
			this.firingDepth += 1;
			if (!this.hasOnce) {
				if (this.holes === 0) {
					for (let i = 0; i < n; i++) {
						(arr[i] as unknown as (...a: Array<unknown>) => unknown)(...spread);
					}
				} else {
					for (let i = 0; i < n; i++) {
						const h = arr[i] as unknown;
						if (h !== DEAD_HANDLER) {
							(h as (...a: Array<unknown>) => unknown)(...spread);
						}
					}
				}
			} else {
				const conns = this.connsArr;
				for (let i = 0; i < n; i++) {
					const h = arr[i] as unknown;
					if (h !== DEAD_HANDLER) {
						(h as (...a: Array<unknown>) => unknown)(...spread);
						const c = conns[i] as unknown;
						if (c !== DEAD_CONN && (c as Connection<T>).isOnce) (c as Connection<T>).disconnect();
					}
				}
			}
			this.firingDepth -= 1;
			if (this.firingDepth === 0 && this.holes > 0) this.compactArr();
			return;
		}
		const name = this.name;
		const conns = this.connsArr;
		this.firingDepth += 1;
		for (let i = 0; i < n; i++) {
			const h = arr[i] as unknown;
			if (h !== DEAD_HANDLER) {
				const [ok, err] = pcall(h as (...a: Array<unknown>) => unknown, ...spread);
				if (!ok) warn(`[SignalX/${name}] handler error: ${err}`);
				if (this.hasOnce) {
					const c = conns[i] as unknown;
					if (c !== DEAD_CONN && (c as Connection<T>).isOnce) (c as Connection<T>).disconnect();
				}
			}
		}
		this.firingDepth -= 1;
		if (this.firingDepth === 0 && this.holes > 0) this.compactArr();
	}
	private compactArr(): void {
		const arr = this.handlersArr;
		const conns = this.connsArr;
		const n = arr.size();
		let write = 0;
		for (let i = 0; i < n; i++) {
			const h = arr[i] as unknown;
			if (h !== DEAD_HANDLER) {
				if (i !== write) {
					arr[write] = h as T;
					const c = conns[i] as Connection<T>;
					conns[write] = c;
					c.arrIdx = write;
				}
				write += 1;
			}
		}
		for (let i = n - 1; i >= write; i--) {
			arr.pop();
			conns.pop();
		}
		this.holes = 0;
	}
	public fireDeferred(...args: InferArgs<T>): void {
		if (this.destroyed) return;
		const arr = this.handlersArr;
		const conns = this.connsArr;
		const n = arr.size();
		if (n === 0) return;
		const spread = args as unknown as Array<unknown>;
		for (let i = 0; i < n; i++) {
			const h = arr[i] as unknown;
			if (h === DEAD_HANDLER) continue;
			const captured = conns[i] as Connection<T>;
			const handler = h as (...a: Array<unknown>) => unknown;
			task.defer(() => {
				if (!captured.connected) return;
				handler(...spread);
				if (captured.isOnce) captured.disconnect();
			});
		}
	}
	public disconnectAll(): void {
		const conns = this.connsArr;
		const n = conns.size();
		for (let i = 0; i < n; i++) {
			const c = conns[i] as unknown;
			if (c !== DEAD_CONN) {
				const conn = c as Connection<T>;
				conn.connected = false;
				conn.arrIdx = -1;
			}
		}
		const arr = this.handlersArr;
		for (let i = arr.size() - 1; i >= 0; i--) arr.pop();
		for (let i = conns.size() - 1; i >= 0; i--) conns.pop();
		this.count = 0;
		this.holes = 0;
		this.onceCount = 0;
		this.hasOnce = false;
	}
	public getConnectionCount(): number {
		return this.count;
	}
	public destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.disconnectAll();
	}
	public isDestroyed(): boolean {
		return this.destroyed;
	}
	public _removeConnection(node: Connection<T>): void {
		const idx = node.arrIdx;
		if (idx < 0) return;
		node.arrIdx = -1;
		this.count -= 1;
		if (node.isOnce) {
			this.onceCount -= 1;
			if (this.onceCount <= 0) {
				this.onceCount = 0;
				this.hasOnce = false;
			}
		}
		if (this.firingDepth > 0) {
			this.handlersArr[idx] = DEAD_HANDLER as T;
			this.connsArr[idx] = DEAD_CONN as Connection<T>;
			this.holes += 1;
			return;
		}
		const arr = this.handlersArr;
		const conns = this.connsArr;
		const last = arr.size() - 1;
		if (idx !== last) {
			arr[idx] = arr[last] as T;
			const lastConn = conns[last] as Connection<T>;
			conns[idx] = lastConn;
			lastConn.arrIdx = idx;
		}
		arr.pop();
		conns.pop();
	}
	private insert(handler: T, isOnce: boolean): Connection<T> {
		const node = new Connection<T>(this, handler, isOnce);
		node.arrIdx = this.handlersArr.size();
		this.handlersArr.push(handler);
		this.connsArr.push(node);
		this.count += 1;
		return node;
	}
}
