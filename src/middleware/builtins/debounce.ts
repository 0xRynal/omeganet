import type { MiddlewareEntry, MiddlewareHandler } from "../types";

export type DebounceOptions = {
	readonly delay: number;
	readonly keyBy?: "global" | "sender";
	readonly trailing?: boolean;
};

export function debounce(options: DebounceOptions): MiddlewareEntry {
	const delay = options.delay;
	const keyBy = options.keyBy ?? "sender";
	const timers = new Map<string, thread>();

	const handler: MiddlewareHandler = (ctx, proceed) => {
		const key = keyBy === "sender" ? tostring(ctx.sender?.UserId ?? "server") : "global";
		const existing = timers.get(key);
		if (existing !== undefined) {
			task.cancel(existing);
			ctx.abort("debounced (superseded)");
			if (options.trailing !== true) return;
		}
		const t = task.delay(delay, () => {
			timers.delete(key);
		});
		timers.set(key, t);
		if (!ctx.isAborted()) proceed();
	};

	return { priority: 70, name: "debounce", handler };
}
