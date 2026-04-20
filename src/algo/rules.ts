import type { SignalStats } from "../devtools/Collector";
import type { Suggestion } from "./Suggestion";
export type Rule = (stats: SignalStats) => Suggestion | undefined;
const now = () => os.clock();
const MIN_FIRES_FOR_RATE = 20;
const MIN_FIRES_FOR_PAYLOAD = 10;
const MIN_FIRES_FOR_ABORT_RATIO = 24;
const MIN_ABORTS_FOR_RATIO = 4;
const MIN_FIRES_FOR_PARALLEL_HINT = 40;
const HIGH_FREQ_PER_S = 60;
const VERY_HIGH_FREQ_PER_S = 100;
const LARGE_AVG_ARGS = 8;
const ABORT_RATIO_WARN = 0.5;
export const defaultRules: ReadonlyArray<Rule> = [
	(stats) => {
		if (stats.fires < MIN_FIRES_FOR_RATE) return undefined;
		if (stats.firesPerSecond <= HIGH_FREQ_PER_S) return undefined;
		return {
			severity: "warn",
			signalName: stats.name,
			rule: "high-frequency",
			message: `Signal "${stats.name}" ~${math.floor(stats.firesPerSecond)} fires/s (rolling 5s) — sustained load`,
			fix: "Consider batching, throttle/debounce middleware, or fewer local dispatches",
			timestamp: now(),
		};
	},
	(stats) => {
		if (stats.fires < MIN_FIRES_FOR_PAYLOAD) return undefined;
		if (stats.avgPayloadCount <= LARGE_AVG_ARGS) return undefined;
		return {
			severity: "info",
			signalName: stats.name,
			rule: "large-payload",
			message: `Signal "${stats.name}" averages ${string.format("%.1f", stats.avgPayloadCount)} args per fire`,
			fix: "Pack data in one table, use compression on remote, or narrow the payload",
			timestamp: now(),
		};
	},
	(stats) => {
		if (stats.fires < MIN_FIRES_FOR_ABORT_RATIO) return undefined;
		if (stats.aborts < MIN_ABORTS_FOR_RATIO) return undefined;
		const ratio = stats.aborts / stats.fires;
		if (ratio <= ABORT_RATIO_WARN) return undefined;
		return {
			severity: "critical",
			signalName: stats.name,
			rule: "high-abort-rate",
			message: `Signal "${stats.name}": ${math.floor(ratio * 100)}% of middleware runs abort (${stats.aborts}/${stats.fires})`,
			fix: "Check validation order, rate limits, and auth — many aborted fires waste work",
			timestamp: now(),
		};
	},
	(stats) => {
		if (stats.mode !== "local") return undefined;
		if (stats.fires < MIN_FIRES_FOR_PARALLEL_HINT) return undefined;
		if (stats.firesPerSecond <= VERY_HIGH_FREQ_PER_S) return undefined;
		return {
			severity: "info",
			signalName: stats.name,
			rule: "consider-parallel",
			message: `Signal "${stats.name}" is hot in local mode (~${math.floor(stats.firesPerSecond)}/s)`,
			fix: "If work per handler is heavy, try mode: \"parallel\" and an Actor pool",
			timestamp: now(),
		};
	},
];