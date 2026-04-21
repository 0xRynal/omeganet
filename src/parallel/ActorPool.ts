import { RunService, ServerScriptService, ReplicatedStorage } from "@rbxts/services";
import type { ActorPoolOptions } from "./types";
const IS_SERVER = RunService.IsServer();
const MAX_ACTORS = 64;
const MIN_ACTORS = 1;
function computeDefaultSize(): number {
	return math.clamp(4, MIN_ACTORS, MAX_ACTORS);
}
function hashString(str: string): number {
	let h = 0;
	for (let i = 0; i < str.size(); i++) {
		const [b] = string.byte(str, i + 1);
		h = (h * 31 + (b ?? 0)) % 1_000_003;
	}
	return h;
}
function getPoolRoot(): Folder {
	const parent = IS_SERVER ? ServerScriptService : ReplicatedStorage;
	let folder = parent.FindFirstChild("Omeganet_Actors");
	if (folder === undefined) {
		const created = new Instance("Folder");
		created.Name = "Omeganet_Actors";
		created.Parent = parent;
		folder = created;
	}
	if (!folder.IsA("Folder")) throw `[Omeganet] Actor root wrong class`;
	return folder;
}
export class ActorPool {
	public readonly name: string;
	public readonly size: number;
	private actors: Array<Actor> = [];
	private nextIndex = 0;
	private destroyed = false;
	private readonly root: Folder;
	constructor(options: ActorPoolOptions) {
		this.name = options.name;
		const requested = options.size ?? computeDefaultSize();
		const cap = options.maxSize ?? MAX_ACTORS;
		this.size = math.clamp(requested, MIN_ACTORS, math.min(cap, MAX_ACTORS));
		this.root = (options.parent as Folder | undefined) ?? getPoolRoot();
		this.spawnActors();
	}
	public send(topic: string, ...args: Array<unknown>): void {
		this.sendTo(this.nextIndex, topic, ...args);
		this.nextIndex = (this.nextIndex + 1) % this.size;
	}
	public sendTo(index: number, topic: string, ...args: Array<unknown>): void {
		if (this.destroyed) return;
		const actor = this.actors[index % this.size];
		if (actor === undefined) return;
		actor.SendMessage(topic, ...args);
	}
	public sendByKey(key: string, topic: string, ...args: Array<unknown>): void {
		const index = hashString(key) % this.size;
		this.sendTo(index, topic, ...args);
	}
	public destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		for (const actor of this.actors) actor.Destroy();
		this.actors.clear();
	}
	private spawnActors(): void {
		const container = new Instance("Folder");
		container.Name = `${this.name}_Pool`;
		container.Parent = this.root;
		for (let i = 0; i < this.size; i++) {
			const actor = new Instance("Actor");
			actor.Name = `${this.name}_Actor_${i}`;
			actor.Parent = container;
			this.actors.push(actor);
		}
	}
}
