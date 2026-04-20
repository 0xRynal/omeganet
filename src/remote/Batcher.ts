import { RunService } from "@rbxts/services";
export type Flusher<TArgs extends ReadonlyArray<unknown>> = (batch: ReadonlyArray<TArgs>) => void;
export class Batcher<TArgs extends ReadonlyArray<unknown>> {
	private buffer: Array<TArgs> = [];
	private connection: RBXScriptConnection | undefined;
	private lastFlush = 0;
	constructor(
		private readonly flusher: Flusher<TArgs>,
		private readonly window: number,
		private readonly maxSize: number,
	) {}
	public push(args: TArgs): void {
		this.buffer.push(args);
		if (this.buffer.size() >= this.maxSize) {
			this.flush();
			return;
		}
		this.ensureScheduler();
	}
	public flush(): void {
		if (this.buffer.size() === 0) return;
		const batch = this.buffer;
		this.buffer = [];
		this.lastFlush = os.clock();
		this.flusher(batch);
	}
	public destroy(): void {
		this.connection?.Disconnect();
		this.connection = undefined;
		this.buffer = [];
	}
	private ensureScheduler(): void {
		if (this.connection !== undefined) return;
		this.connection = RunService.Heartbeat.Connect(() => {
			if (os.clock() - this.lastFlush >= this.window) {
				this.flush();
				this.connection?.Disconnect();
				this.connection = undefined;
			}
		});
	}
}