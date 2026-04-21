import { Omeganet } from "@rbxts/omeganet";

const onPlayerJoin = Omeganet.Omega.create<(player: Player) => void>({
	name: "onPlayerJoin",
	mode: "local",
});

onPlayerJoin.connect((player) => {
	print(`[basic] ${player.Name} joined — current connections: 1`);
});

onPlayerJoin.once((player) => {
	print(`[basic] once-handler fired for ${player.Name}`);
});

const connection = onPlayerJoin.connect((player) => {
	print(`[basic] temporary listener for ${player.Name}`);
});

task.delay(5, () => {
	connection.disconnect();
	print("[basic] temporary listener disconnected");
});
