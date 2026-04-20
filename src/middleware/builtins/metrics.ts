import type { MiddlewareEntry, MiddlewareHandler } from "../types";

export type MetricsSnapshot = {
	readonly fires: number;
	readonly aborts: number;
	readonly lastFireTimestamp: number;
	readonly avgLatencyMs: number;
	readonly maxLatencyMs: number;
	readonly minLatencyMs: number;
	readonly firesPerSecond: number;
};

export type MetricsOptions = {
	readonly window?: number;
	readonly onUpdate?: (snapshot: MetricsSnapshot) => void;
};

export type MetricsHandle = {
	readonly middleware: MiddlewareEntry;
	readonly snapshot: () => MetricsSnapshot;
	readonly reset: () => void;
};

export function metrics(options: MetricsOptions = {}): MetricsHandle {
	const window = options.window ?? 10;
	let fires = 0;
	let aborts = 0;
	let latSum = 0;
	let latMax = 0;
	let latMin = math.huge;
	let lastTs = 0;
	const recent: Array<number> = [];

	const handler: MiddlewareHandler = (ctx, proceed) => {
		const start = os.clock();
		lastTs = start;
		fires += 1;
		recent.push(start);
		while (recent.size() > 0) {
			const first = recent[0];
			if (first === undefined || start - first > window) recent.shift();
			else break;
		}
		proceed();
		const elapsed = (os.clock() - start) * 1000;
		latSum += elapsed;
		if (elapsed > latMax) latMax = elapsed;
		if (elapsed < latMin) latMin = elapsed;
		if (ctx.isAborted()) aborts += 1;
		options.onUpdate?.(build());
	};

	const build = (): MetricsSnapshot => ({
		fires,
		aborts,
		lastFireTimestamp: lastTs,
		avgLatencyMs: fires > 0 ? latSum / fires : 0,
		maxLatencyMs: latMax,
		minLatencyMs: latMin === math.huge ? 0 : latMin,
		firesPerSecond: recent.size() / window,
	});

	const reset = () => {
		fires = 0;
		aborts = 0;
		latSum = 0;
		latMax = 0;
		latMin = math.huge;
		recent.clear();
	};

	return {
		middleware: { priority: 5, name: "metrics", handler },
		snapshot: build,
		reset,
	};
}
