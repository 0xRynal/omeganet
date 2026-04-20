import { SignalX, rateLimit, validate, schema, auth } from "@rbxts/omeganet";

const damageSignal = SignalX.Omega.create<(targetId: number, amount: number) => void>({
	name: "dealDamage",
	mode: "remote",
	reliability: "reliable",
	batch: true,
	compression: "rle",
});

damageSignal
	.use(auth({ serverOnly: false }))
	.use(rateLimit({ perSecond: 10, burst: 20 }))
	.use(
		validate<[number, number]>({
			schemas: [schema.number(0), schema.number(0, 100)],
		}),
	);

damageSignal.connect((targetId, amount) => {
	print(`[server] applying ${amount} damage to target ${targetId}`);
});
