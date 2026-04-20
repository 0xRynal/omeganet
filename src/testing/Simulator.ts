import type { OmegaSignal } from "../omega/types";
import type { SignalCallback } from "../core/types";

export type SimulatorOptions<T extends SignalCallback> = {
	readonly clients: number;
	readonly firesPerSecond: number;
	readonly duration: number;
	readonly argsFactory: (clientIndex: number, frame: number) => Parameters<T>;
};

export type SimulationReport = {
	readonly totalFires: number;
	readonly totalDuration: number;
	readonly avgFireIntervalMs: number;
};

export function simulate<T extends SignalCallback>(
	signal: OmegaSignal<T>,
	options: SimulatorOptions<T>,
): SimulationReport {
	const startClock = os.clock();
	const step = 1 / options.firesPerSecond;
	let totalFires = 0;

	for (let frame = 0; frame * step < options.duration; frame++) {
		for (let c = 0; c < options.clients; c++) {
			signal.fire(...options.argsFactory(c, frame));
			totalFires += 1;
		}
		task.wait(step);
	}

	const elapsed = os.clock() - startClock;
	return {
		totalFires,
		totalDuration: elapsed,
		avgFireIntervalMs: totalFires > 0 ? (elapsed * 1000) / totalFires : 0,
	};
}
