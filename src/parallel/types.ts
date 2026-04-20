export type ActorPoolOptions = {
	readonly name: string;
	readonly size?: number;
	readonly maxSize?: number;
	readonly dispatch?: "round-robin" | "hash";
	readonly parent?: Instance;
};
export type SharedStateOptions<T extends object> = {
	readonly name: string;
	readonly initial: T;
};
export type Unsubscribe = () => void;