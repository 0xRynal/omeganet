import { RunService } from "@rbxts/services";
interface WriteRecord {
	writers: Set<string>;
	tick: number;
}
export class RaceDetector {
	private records = new Map<string, WriteRecord>();
	private currentTick = 0;
	private connection: RBXScriptConnection | undefined;
	private readonly listeners = new Set<(path: string, writers: ReadonlyArray<string>) => void>();
	constructor() {
		this.connection = RunService.Heartbeat.Connect(() => {
			this.currentTick += 1;
			this.records.clear();
		});
	}
	public recordWrite(path: string, writer: string): void {
		let rec = this.records.get(path);
		if (rec === undefined) {
			rec = { writers: new Set(), tick: this.currentTick };
			this.records.set(path, rec);
		}
		rec.writers.add(writer);
		if (rec.writers.size() > 1) {
			const writersArr: Array<string> = [];
			for (const w of rec.writers) writersArr.push(w);
			for (const fn of this.listeners) fn(path, writersArr);
		}
	}
	public onRace(fn: (path: string, writers: ReadonlyArray<string>) => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}
	public destroy(): void {
		this.connection?.Disconnect();
		this.connection = undefined;
		this.records.clear();
		this.listeners.clear();
	}
}