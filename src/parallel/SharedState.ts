import { Signal } from "../core/Signal";
import { RaceDetector } from "./RaceDetector";
import type { SharedStateOptions, Unsubscribe } from "./types";
export class SharedState<T extends object> {
	public readonly name: string;
	private readonly table: SharedTable;
	private readonly versions = new Map<string, number>();
	private readonly subscribers = new Map<string, Signal<(value: unknown, previous: unknown) => void>>();
	public readonly racer = new RaceDetector();
	constructor(options: SharedStateOptions<T>) {
		this.name = options.name;
		this.table = new SharedTable();
		for (const [k, v] of pairs(options.initial as object)) {
			this.table[k as string] = v as SharedTableValue;
		}
	}
	public get<K extends string>(path: K): unknown {
		return this.table[path];
	}
	public set<K extends string>(path: K, value: unknown, writerTag = "unknown"): void {
		const previous = this.table[path];
		this.table[path] = value as SharedTableValue;
		this.versions.set(path, (this.versions.get(path) ?? 0) + 1);
		this.racer.recordWrite(path, writerTag);
		const signal = this.subscribers.get(path);
		if (signal !== undefined) signal.fire(value, previous);
	}
	public update<K extends string>(
		path: K,
		updater: (current: unknown) => unknown,
		writerTag = "unknown",
	): void {
		this.set(path, updater(this.get(path)), writerTag);
	}
	public subscribe<V = unknown>(
		path: string,
		handler: (value: V, previous: V) => void,
	): Unsubscribe {
		let signal = this.subscribers.get(path);
		if (signal === undefined) {
			signal = new Signal({ name: `${this.name}.${path}` });
			this.subscribers.set(path, signal);
		}
		const conn = signal.connect(handler as unknown as (value: unknown, previous: unknown) => void);
		return () => conn.disconnect();
	}
	public getVersion(path: string): number {
		return this.versions.get(path) ?? 0;
	}
	public raw(): SharedTable {
		return this.table;
	}
	public destroy(): void {
		this.racer.destroy();
		for (const [, sig] of this.subscribers) sig.destroy();
		this.subscribers.clear();
		this.versions.clear();
	}
}