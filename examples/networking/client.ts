import { SignalX } from "@rbxts/omeganet";

const damageSignal = SignalX.Omega.create<(targetId: number, amount: number) => void>({
	name: "dealDamage",
	mode: "remote",
	batch: true,
});

task.spawn(() => {
	for (let i = 0; i < 50; i++) {
		damageSignal.fire(123, 10);
		task.wait(0.05);
	}
});
