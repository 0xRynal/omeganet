import type { MiddlewareEntry, MiddlewareHandler } from "../types";

export type AuthOptions = {
	readonly allow?: (player: Player) => boolean;
	readonly deny?: (player: Player) => boolean;
	readonly allowedUserIds?: ReadonlyArray<number>;
	readonly allowedGroupId?: number;
	readonly allowedGroupRank?: number;
	readonly serverOnly?: boolean;
};

export function auth(options: AuthOptions): MiddlewareEntry {
	const allowedSet = new Set(options.allowedUserIds ?? []);

	const handler: MiddlewareHandler = (ctx, proceed) => {
		const sender = ctx.sender;
		if (options.serverOnly === true && sender !== undefined) {
			ctx.abort("server-only");
			return;
		}
		if (sender === undefined) {
			proceed();
			return;
		}
		if (options.deny?.(sender) === true) {
			ctx.abort("denied by policy");
			return;
		}
		if (allowedSet.size() > 0 && !allowedSet.has(sender.UserId)) {
			ctx.abort("userId not in allowlist");
			return;
		}
		if (options.allowedGroupId !== undefined) {
			const rank = sender.GetRankInGroup(options.allowedGroupId);
			const minRank = options.allowedGroupRank ?? 1;
			if (rank < minRank) {
				ctx.abort(`insufficient group rank (${rank} < ${minRank})`);
				return;
			}
		}
		if (options.allow !== undefined && !options.allow(sender)) {
			ctx.abort("allow() returned false");
			return;
		}
		proceed();
	};

	return { priority: 95, name: "auth", handler };
}
