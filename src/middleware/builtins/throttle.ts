import type { MiddlewareEntry, MiddlewareHandler } from "../types";

export type ThrottleOptions = {
	readonly interval: number;
	readonly keyBy?: "global" | "sender";
};

export function throttle(options: ThrottleOptions): MiddlewareEntry {
	const interval = options.interval;
	const keyBy = options.keyBy ?? "sender";
	const lastRun = new Map<string, number>();

	const handler: MiddlewareHandler = (ctx, proceed) => {
		const key = keyBy === "sender" ? tostring(ctx.sender?.UserId ?? "server") : "global";
		const now = os.clock();
		const last = lastRun.get(key) ?? 0;
		if (now - last < interval) {
			ctx.abort("throttled");
			return;
		}
		lastRun.set(key, now);
		proceed();
	};

	return { priority: 70, name: "throttle", handler };
}
