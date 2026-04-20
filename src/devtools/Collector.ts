import { Signal } from "../core/Signal";
import type { OmegaMode } from "../omega/types";

export type SignalStats = {
	readonly name: string;
	readonly mode: OmegaMode;
	readonly fires: number;
	readonly aborts: number;
	readonly firesPerSecond: number;
	readonly avgPayloadCount: number;
	readonly lastFireTimestamp: number;
	readonly lastAbortReason?: string;
};

type InternalStats = {
	name: string;
	mode: OmegaMode;
	fires: number;
	aborts: number;
	payloadSum: number;
	lastFireTimestamp: number;
	recent: Array<number>;
	lastAbortReason?: string;
};

const RECENT_WINDOW = 5;
const signals = new Map<string, InternalStats>();

export type DevToolsEvent = {
	readonly kind: "fire" | "abort" | "track" | "untrack";
	readonly name: string;
	readonly timestamp: number;
	readonly payload?: number;
	readonly reason?: string;
};

export const DevToolsStream = new Signal<(event: DevToolsEvent) => void>({
	name: "DevToolsStream",
});

function getOrCreate(name: string, mode: OmegaMode): InternalStats {
	let s = signals.get(name);
	if (s === undefined) {
		s = {
			name,
			mode,
			fires: 0,
			aborts: 0,
			payloadSum: 0,
			lastFireTimestamp: 0,
			recent: [],
		};
		signals.set(name, s);
	}
	return s;
}

function toPublic(s: InternalStats): SignalStats {
	const now = os.clock();
	while (s.recent.size() > 0) {
		const first = s.recent[0];
		if (first === undefined || now - first > RECENT_WINDOW) s.recent.shift();
		else break;
	}
	return {
		name: s.name,
		mode: s.mode,
		fires: s.fires,
		aborts: s.aborts,
		firesPerSecond: s.recent.size() / RECENT_WINDOW,
		avgPayloadCount: s.fires > 0 ? s.payloadSum / s.fires : 0,
		lastFireTimestamp: s.lastFireTimestamp,
		...(s.lastAbortReason !== undefined ? { lastAbortReason: s.lastAbortReason } : {}),
	};
}

export const Collector = {
	trackSignal(name: string, mode: OmegaMode): void {
		getOrCreate(name, mode);
		DevToolsStream.fire({ kind: "track", name, timestamp: os.clock() });
	},

	untrackSignal(name: string): void {
		signals.delete(name);
		DevToolsStream.fire({ kind: "untrack", name, timestamp: os.clock() });
	},

	recordFire(name: string, payload: number): void {
		const s = signals.get(name);
		if (s === undefined) return;
		const now = os.clock();
		s.fires += 1;
		s.payloadSum += payload;
		s.lastFireTimestamp = now;
		s.recent.push(now);
		DevToolsStream.fire({ kind: "fire", name, timestamp: now, payload });
	},

	recordAbort(name: string, reason: string | undefined): void {
		const s = signals.get(name);
		if (s === undefined) return;
		s.aborts += 1;
		if (reason !== undefined) s.lastAbortReason = reason;
		DevToolsStream.fire({
			kind: "abort",
			name,
			timestamp: os.clock(),
			...(reason !== undefined ? { reason } : {}),
		});
	},

	getStats(name: string): SignalStats | undefined {
		const s = signals.get(name);
		return s !== undefined ? toPublic(s) : undefined;
	},

	getAllStats(): ReadonlyArray<SignalStats> {
		const out: Array<SignalStats> = [];
		for (const [, s] of signals) out.push(toPublic(s));
		return out;
	},

	reset(): void {
		signals.clear();
	},
};
