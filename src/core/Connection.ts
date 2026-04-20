import type { SignalCallback, SignalConnection } from "./types";
export class Connection<T extends SignalCallback> {
	public connected = true;
	public arrIdx = -1;
	constructor(
		private readonly signal: { _removeConnection(node: Connection<T>): void },
		public readonly handler: T,
		public readonly isOnce: boolean,
	) {}
	public disconnect(): void {
		if (!this.connected) return;
		this.connected = false;
		this.signal._removeConnection(this);
	}
}
export function asConnection<T extends SignalCallback>(node: Connection<T>): SignalConnection {
	return node satisfies SignalConnection;
}