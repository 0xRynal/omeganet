
import { MiddlewareChain } from "../../src/middleware/MiddlewareChain";
import { Reconciler } from "../../src/remote/Reconciler";
import { Signal } from "../../src/core/Signal";
import { Subject } from "../../src/reactive/Subject";
import { clearPool, poolSize } from "../../src/core/ThreadPool";
declare function gcinfo(): number;
type LeakCase = {
	readonly name: string;
	readonly tolerateKb: number;
	readonly run: () => void;
};
export type MemoryCaseResult = {
	readonly name: string;
	readonly beforeKb: number;
	readonly afterKb: number;
	readonly deltaKb: number;
	readonly tolerateKb: number;
	readonly poolDelta: number;
	readonly passed: boolean;
	readonly durationMs: number;
};
export type MemoryReport = {
	readonly results: ReadonlyArray<MemoryCaseResult>;
	readonly failed: number;
	readonly passed: number;
	readonly durationMs: number;
};
function yieldGc(frames: number): void {
	for (let i = 0; i < frames; i++) task.wait();
}
function chunked(total: number, body: (i: number) => void, chunk = 10_000): void {
	for (let base = 0; base < total; base += chunk) {
		const stop = math.min(base + chunk, total);
		for (let i = base; i < stop; i++) body(i);
		task.wait();
	}
}
const ITERATIONS = 100_000;
const cases: Array<LeakCase> = [
	{
		name: "Signal churn (connect/fire/disconnect)",
		tolerateKb: 2_048,
		run: () => {
			chunked(ITERATIONS, (i) => {
				const s = new Signal<(n: number) => void>();
				const c = s.connect(() => {});
				s.fire(i);
				c.disconnect();
				s.destroy();
			});
		},
	},
	{
		name: "Signal once auto-cleanup",
		tolerateKb: 2_048,
		run: () => {
			const s = new Signal<() => void>();
			chunked(ITERATIONS, () => {
				s.once(() => {});
				s.fire();
			});
			task.wait();
			assert(s.getConnectionCount() === 0, "once handlers leaked");
			s.destroy();
		},
	},
	{
		name: "Signal disconnectAll release",
		tolerateKb: 16_384,
		run: () => {
			const s = new Signal<() => void>();
			chunked(ITERATIONS, () => s.connect(() => {}));
			s.disconnectAll();
			assert(s.getConnectionCount() === 0, "disconnectAll did not clear nodes");
			s.destroy();
		},
	},
	{
		name: "Subject subscribe/unsubscribe churn",
		tolerateKb: 2_048,
		run: () => {
			const subj = new Subject<number>();
			chunked(ITERATIONS, (i) => {
				const sub = subj.subscribe(() => {});
				subj.next(i);
				sub.unsubscribe();
			});
			assert(subj.observerCount() === 0, "Subject retained observers");
			subj.complete();
		},
	},
	{
		name: "MiddlewareChain executeSync churn",
		tolerateKb: 2_048,
		run: () => {
			const chain = new MiddlewareChain<[number]>();
			chain.use({
				priority: 0,
				name: "noop",
				handler: (_, proceed) => proceed(),
			});
			chunked(ITERATIONS, (i) => {
				chain.executeSync([i], "leak-test");
			});
		},
	},
	{
		name: "Reconciler predict/reconcile prune",
		tolerateKb: 2_048,
		run: () => {
			const r = new Reconciler<number, number>({
				initialState: 0,
				apply: (s, input) => s + input,
				quiet: true,
			});
			chunked(ITERATIONS, (i) => {
				r.predict(1, i);
				if (i % 8 === 0) r.reconcile(i / 8, i);
			});
			r.reconcile(ITERATIONS, ITERATIONS);
			assert(r.pendingCount() === 0, "Reconciler retained pending inputs");
		},
	},
	{
		name: "ThreadPool fire saturation",
		tolerateKb: 1_024,
		run: () => {
			clearPool();
			const s = new Signal<() => void>();
			for (let i = 0; i < 16; i++) s.connect(() => {});
			chunked(25_000, () => s.fire());
			s.destroy();
			task.wait();
		},
	},
];
function measureCase(c: LeakCase): {
	readonly before: number;
	readonly after: number;
	readonly delta: number;
	readonly poolBefore: number;
	readonly poolAfter: number;
	readonly durationMs: number;
} {
	c.run();
	yieldGc(8);
	let maxDelta = -math.huge;
	let firstBefore = 0;
	let lastAfter = 0;
	let poolBefore = 0;
	let poolAfter = 0;
	let durationMs = 0;
	for (let sample = 0; sample < 2; sample++) {
		yieldGc(4);
		const before = gcinfo();
		const pb = poolSize();
		const t0 = os.clock();
		c.run();
		durationMs += (os.clock() - t0) * 1000;
		yieldGc(4);
		const after = gcinfo();
		const pa = poolSize();
		const delta = after - before;
		if (delta > maxDelta) maxDelta = delta;
		if (sample === 0) {
			firstBefore = before;
			poolBefore = pb;
		}
		lastAfter = after;
		poolAfter = pa;
	}
	return {
		before: firstBefore,
		after: lastAfter,
		delta: maxDelta,
		poolBefore,
		poolAfter,
		durationMs,
	};
}
export function runMemoryTests(): MemoryReport {
	print("");
	print("=======================================================");
	print("  SignalX — memory retention (advisory)");
	print("=======================================================");
	print("  delta KB = gcinfo() after − before (Roblox: no full GC)");
	print("  tol      = max allowed |delta| for PASS");
	print("  pool     = ThreadPool size delta (should stay ~0)");
	print("  [OK ]    = under tolerance   |   [HIGH] = over (not always a leak)");
	print("-------------------------------------------------------");
	const results: Array<MemoryCaseResult> = [];
	const suiteStart = os.clock();
	let failed = 0;
	let passed = 0;
	for (const c of cases) {
		const m = measureCase(c);
		const poolDelta = m.poolAfter - m.poolBefore;
		const caseOk = m.delta <= c.tolerateKb;
		if (caseOk) passed += 1;
		else failed += 1;
		const tag = caseOk ? "OK  " : "HIGH";
		const log = string.format(
			"  [%s] %-40s  delta=%+.2f KB (tol %.1f)  pool=%+d  run=%.2f ms",
			tag,
			c.name,
			m.delta,
			c.tolerateKb,
			poolDelta,
			m.durationMs,
		);
		if (caseOk) print(log);
		else warn(log);
		results.push({
			name: c.name,
			beforeKb: m.before,
			afterKb: m.after,
			deltaKb: m.delta,
			tolerateKb: c.tolerateKb,
			poolDelta,
			passed: caseOk,
			durationMs: m.durationMs,
		});
		yieldGc(4);
	}
	const totalMs = (os.clock() - suiteStart) * 1000;
	print("  -------------------------------------------------------");
	print(
		string.format(
			"  Total: %d  |  OK: %d  |  Over-threshold: %d  |  Duration: %.2f ms",
			results.size(),
			passed,
			failed,
			totalMs,
		),
	);
	if (failed === 0) {
		print("  [RESULT] All cases under their retention threshold");
	} else {
		warn(`  [RESULT] ${failed} case(s) retained more memory than expected`);
	}
	print("=======================================================");
	return { results, passed, failed, durationMs: totalMs };
}