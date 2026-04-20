import type { MiddlewareEntry, MiddlewareHandler } from "../types";

export type CircuitBreakerOptions = {
	readonly failureThreshold?: number;
	readonly recoveryTime?: number;
	readonly halfOpenMax?: number;
	readonly onOpen?: () => void;
	readonly onClose?: () => void;
};

type CircuitState = "closed" | "open" | "halfOpen";

export function circuitBreaker(options: CircuitBreakerOptions = {}): MiddlewareEntry {
	const failureThreshold = options.failureThreshold ?? 5;
	const recoveryTime = options.recoveryTime ?? 10;
	const halfOpenMax = options.halfOpenMax ?? 3;

	let state: CircuitState = "closed";
	let failures = 0;
	let openedAt = 0;
	let halfOpenInFlight = 0;

	const handler: MiddlewareHandler = (ctx, proceed) => {
		const now = os.clock();

		if (state === "open") {
			if (now - openedAt >= recoveryTime) {
				state = "halfOpen";
				halfOpenInFlight = 0;
			} else {
				ctx.abort("circuit open");
				return;
			}
		}

		if (state === "halfOpen") {
			if (halfOpenInFlight >= halfOpenMax) {
				ctx.abort("circuit half-open saturated");
				return;
			}
			halfOpenInFlight += 1;
		}

		proceed();

		if (ctx.isAborted()) {
			failures += 1;
			if (failures >= failureThreshold && state === "closed") {
				state = "open";
				openedAt = now;
				options.onOpen?.();
			} else if (state === "halfOpen") {
				state = "open";
				openedAt = now;
				options.onOpen?.();
			}
		} else if (state === "halfOpen") {
			state = "closed";
			failures = 0;
			options.onClose?.();
		} else {
			failures = 0;
		}
	};

	return { priority: 80, name: "circuitBreaker", handler };
}
