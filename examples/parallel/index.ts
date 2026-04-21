import { Omeganet, SharedState } from "@rbxts/omeganet";

const simulation = Omeganet.Omega.create<(entityId: number, dt: number) => void>({
	name: "entitySimulation",
	mode: "parallel",
	parallel: true,
	parallelPoolSize: 8,
});

const world = new SharedState<{ tick: number; entityCount: number }>({
	name: "world",
	initial: { tick: 0, entityCount: 0 },
});

world.subscribe<number>("tick", (tick) => {
	if (tick % 60 === 0) print(`[parallel] tick=${tick}`);
});

world.racer.onRace((path, writers) => {
	warn(`[parallel] race detected on ${path} — writers=${writers.join(",")}`);
});

task.spawn(() => {
	while (true) {
		for (let id = 0; id < 100; id++) {
			simulation.fireParallel(id, 1 / 60);
		}
		world.update("tick", (t) => (typeIs(t, "number") ? t + 1 : 1), "main");
		task.wait(1 / 60);
	}
});
