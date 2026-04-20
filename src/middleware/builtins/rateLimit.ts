import type { MiddlewareEntry, MiddlewareHandler } from "../types";

export type RateLimitOptions = {
	readonly perSecond?: number;
	readonly burst?: number;
	readonly keyBy?: "global" | "sender";
	readonly onLimit?: (key: string, reason: string) => void;
};

type Bucket = {
	tokens: number;
	lastRefill: number;
};

export function rateLimit(options: RateLimitOptions): MiddlewareEntry {
	const perSecond = options.perSecond ?? 10;
	const burst = options.burst ?? perSecond;
	const keyBy = options.keyBy ?? "sender";
	const buckets = new Map<string, Bucket>();

	const handler: MiddlewareHandler = (ctx, proceed) => {
		const key = keyBy === "sender" ? tostring(ctx.sender?.UserId ?? "server") : "global";
		const now = os.clock();
		let bucket = buckets.get(key);
		if (bucket === undefined) {
			bucket = { tokens: burst, lastRefill: now };
			buckets.set(key, bucket);
		}
		const elapsed = now - bucket.lastRefill;
		bucket.tokens = math.min(burst, bucket.tokens + elapsed * perSecond);
		bucket.lastRefill = now;

		if (bucket.tokens < 1) {
			ctx.abort(`rate-limited on key "${key}"`);
			options.onLimit?.(key, "tokens exhausted");
			return;
		}
		bucket.tokens -= 1;
		proceed();
	};

	return { priority: 100, name: "rateLimit", handler };
}
