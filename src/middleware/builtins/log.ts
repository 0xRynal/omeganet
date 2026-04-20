import { HttpService } from "@rbxts/services";
import type { MiddlewareEntry, MiddlewareHandler } from "../types";

export type LogOptions = {
	readonly level?: "trace" | "info" | "warn";
	readonly includeArgs?: boolean;
	readonly sink?: (message: string) => void;
};

export function log(options: LogOptions = {}): MiddlewareEntry {
	const level = options.level ?? "info";
	const includeArgs = options.includeArgs ?? false;
	const sink = options.sink ?? ((message: string) => print(message));

	const handler: MiddlewareHandler = (ctx, proceed) => {
		const base = `[SignalX/${level}] ${ctx.signalName} <- ${ctx.sender?.Name ?? "server"}`;
		let message = base;
		if (includeArgs) {
			const [ok, encoded] = pcall(() => HttpService.JSONEncode(ctx.getArgs()));
			message = `${base} args=${ok ? tostring(encoded) : "<unencodable>"}`;
		}
		sink(message);
		proceed();
	};

	return { priority: 10, name: "log", handler };
}
