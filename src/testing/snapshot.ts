import { HttpService } from "@rbxts/services";
import { Collector } from "../devtools/Collector";
import type { SignalStats } from "../devtools/Collector";

export type Snapshot = {
	readonly takenAt: number;
	readonly signals: ReadonlyArray<SignalStats>;
};

export function takeSnapshot(): Snapshot {
	return {
		takenAt: os.clock(),
		signals: Collector.getAllStats(),
	};
}

export function serialize(snapshot: Snapshot): string {
	const [ok, encoded] = pcall(() => HttpService.JSONEncode(snapshot));
	if (!ok) return "{}";
	return tostring(encoded);
}

export function assertMatches(a: Snapshot, b: Snapshot, tolerance = 0.01): boolean {
	if (a.signals.size() !== b.signals.size()) return false;
	for (let i = 0; i < a.signals.size(); i++) {
		const sa = a.signals[i];
		const sb = b.signals[i];
		if (sa === undefined || sb === undefined) return false;
		if (sa.name !== sb.name) return false;
		if (math.abs(sa.firesPerSecond - sb.firesPerSecond) > tolerance * math.max(1, sa.firesPerSecond)) {
			return false;
		}
	}
	return true;
}
