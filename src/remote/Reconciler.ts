
export type ReconcilerOptions<TState, TInput> = {
	readonly initialState: TState;
	readonly apply: (state: TState, input: TInput, dt: number) => TState;
	readonly clone?: (state: TState) => TState;
	readonly equals?: (a: TState, b: TState) => boolean;

	readonly quiet?: boolean;
};

type PendingInput<TInput> = {
	seq: number;
	input: TInput;
	dt: number;
};

export class Reconciler<TState, TInput> {
	private state: TState;
	private pending: Array<PendingInput<TInput>> = [];
	private nextSeq = 0;
	private readonly cloneFn: (state: TState) => TState;
	private readonly equalsFn: (a: TState, b: TState) => boolean;

	constructor(private readonly options: ReconcilerOptions<TState, TInput>) {
		this.cloneFn = options.clone ?? ((s) => s);
		this.equalsFn = options.equals ?? ((a, b) => a === b);
		this.state = this.cloneFn(options.initialState);
	}

	public getState(): TState {
		return this.state;
	}

	public predict(input: TInput, dt: number): { state: TState; seq: number } {
		const seq = this.nextSeq++;
		this.pending.push({ seq, input, dt });
		this.state = this.options.apply(this.state, input, dt);
		return { state: this.state, seq };
	}

	public reconcile(authoritativeState: TState, lastProcessedSeq: number): TState {
		this.pending = this.pending.filter((p) => p.seq > lastProcessedSeq);
		let s = this.cloneFn(authoritativeState);
		for (const p of this.pending) {
			s = this.options.apply(s, p.input, p.dt);
		}
		const drift = !this.equalsFn(s, this.state);
		this.state = s;
		if (drift && this.options.quiet !== true) {
			warn(`[SignalX/Reconciler] drift corrected at seq ${lastProcessedSeq}`);
		}
		return this.state;
	}

	public reset(state: TState): void {
		this.state = this.cloneFn(state);
		this.pending = [];
		this.nextSeq = 0;
	}

	public pendingCount(): number {
		return this.pending.size();
	}
}
