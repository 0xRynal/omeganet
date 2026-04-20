
import { Batcher } from "../../src/remote/Batcher";
import { MiddlewareChain } from "../../src/middleware/MiddlewareChain";
import { Signal } from "../../src/core/Signal";
import { createEventBus } from "../../src/bus/EventBus";
import { rateLimit } from "../../src/middleware/builtins/rateLimit";
export type StressBench = {
	readonly label: string;
	readonly ops: number;
	readonly durationMs: number;
	readonly usPerOp: number;
	readonly note?: string;
};
export type StressReport = {
	readonly benches: ReadonlyArray<StressBench>;
	readonly durationMs: number;
};
function bench(
	label: string,
	ops: number,
	body: (i: number) => void,
	note?: () => string,
	chunk = 200_000,
): StressBench {
	let accumClock = 0;
	for (let base = 0; base < ops; base += chunk) {
		const stop = math.min(base + chunk, ops);
		const t0 = os.clock();
		for (let i = base; i < stop; i++) body(i);
		accumClock += os.clock() - t0;
		task.wait();
	}
	const durationMs = accumClock * 1000;
	const usPerOp = (durationMs * 1000) / ops;
	const resolvedNote = note !== undefined ? note() : undefined;
	const suffix = resolvedNote !== undefined ? `  (${resolvedNote})` : "";
	print(
		string.format(
			"  [BENCH] %-40s %7d ops  %8.2f ms  %7.2f us/op%s",
			label,
			ops,
			durationMs,
			usPerOp,
			suffix,
		),
	);
	return {
		label,
		ops,
		durationMs,
		usPerOp,
		...(resolvedNote !== undefined ? { note: resolvedNote } : {}),
	};
}
export function runStress(): StressReport {
	print("");
	print("=======================================================");
	print("  SignalX — stress benchmarks");
	print("=======================================================");
	print("  ops      = loop iterations (work split with task.wait to avoid timeout)");
	print("  ms       = CPU time in measured slices only (yields excluded)");
	print("  us/op    = microseconds per iteration (lower = faster)");
	print("-------------------------------------------------------");
	const benches: Array<StressBench> = [];
	const suiteStart = os.clock();
	const SIGNAL_OPS = 2_500_000;
	const HANDLERS = 32;
	{
		const s = new Signal<(n: number) => void>();
		for (let i = 0; i < HANDLERS; i++) s.connect(() => {});
		benches.push(bench(`Signal.fire x${HANDLERS} (coroutine)`, SIGNAL_OPS, (i) => s.fire(i)));
		s.destroy();
	}
	{
		const s = new Signal<(n: number) => void>({ sync: true });
		for (let i = 0; i < HANDLERS; i++) s.connect(() => {});
		benches.push(bench(`Signal.fire x${HANDLERS} (sync)`, SIGNAL_OPS, (i) => s.fire(i)));
		s.destroy();
	}
	{
		const s = new Signal<(n: number) => void>({ sync: true, unsafe: true });
		for (let i = 0; i < HANDLERS; i++) s.connect(() => {});
		benches.push(
			bench(`Signal.fire x${HANDLERS} (sync + unsafe)`, SIGNAL_OPS, (i) => s.fire(i)),
		);
		s.destroy();
	}
	{
		const s = new Signal<(n: number) => void>({ sync: true, unsafe: true });
		s.connect(() => {});
		benches.push(
			bench("Signal.fire x1 (sync + unsafe, fast path)", SIGNAL_OPS, (i) => s.fire(i)),
		);
		s.destroy();
	}
	{
		const s = new Signal<() => void>();
		benches.push(
			bench("connect+disconnect churn", SIGNAL_OPS, () => {
				const c = s.connect(() => {});
				c.disconnect();
			}),
		);
		s.destroy();
	}
	{
		type Ev = { tick: [number] };
		const bus = createEventBus<Ev>({ sync: true });
		for (let i = 0; i < HANDLERS; i++) bus.on("tick", () => {});
		benches.push(
			bench(`EventBus.emit x${HANDLERS} (sync)`, SIGNAL_OPS, (i) => bus.emit("tick", i)),
		);
		bus.clear();
	}
	{
		const chain = new MiddlewareChain<[number]>();
		chain.use({ priority: 100, name: "a", handler: (_, p) => p() });
		chain.use({ priority: 50, name: "b", handler: (_, p) => p() });
		chain.use({ priority: 10, name: "c", handler: (_, p) => p() });
		benches.push(
			bench("MiddlewareChain executeSync (3 layers)", 1_000_000, (i) =>
				chain.executeSync([i], "stress"),
			),
		);
	}
	{
		const chain = new MiddlewareChain<[]>();
		chain.use(rateLimit({ perSecond: 1_000_000, burst: 10_000, keyBy: "global" }));
		let allowed = 0;
		let blocked = 0;
		benches.push(
			bench(
				"rateLimit @1M/s burst 10k",
				10_000_000,
				() => {
					const ctx = chain.executeSync([], "r");
					if (ctx.isAborted()) blocked += 1;
					else allowed += 1;
				},
				() => `allowed=${allowed} blocked=${blocked}`,
			),
		);
	}
	{
		let flushes = 0;
		const b = new Batcher<[number]>((batch) => (flushes += batch.size()), 0.05, 128);
		benches.push(
			bench("Batcher.push (flush on size)", 500_000, (i) => b.push([i]), () => `flushed=${flushes}`),
		);
		b.flush();
		b.destroy();
	}
	const totalMs = (os.clock() - suiteStart) * 1000;
	print("  -------------------------------------------------------");
	print(string.format("  Benchmarks: %d  |  Wall time (incl. yields): %.2f ms", benches.size(), totalMs));
	print("=======================================================");
	return { benches, durationMs: totalMs };
}