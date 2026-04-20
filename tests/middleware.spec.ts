import { rateLimit } from "../src/middleware/builtins/rateLimit";
import { validate } from "../src/middleware/builtins/validate";
import { MiddlewareChain } from "../src/middleware/MiddlewareChain";
import { S } from "../src/remote/Validator";
import { describe, expect, it } from "./harness";
export const __spec = "middleware";
describe("MiddlewareChain", () => {
	it("runs in priority order", () => {
		const chain = new MiddlewareChain<[number]>();
		const order: Array<string> = [];
		chain.use({
			priority: 10,
			name: "low",
			handler: (_, proceed) => {
				order.push("low");
				proceed();
			},
		});
		chain.use({
			priority: 100,
			name: "high",
			handler: (_, proceed) => {
				order.push("high");
				proceed();
			},
		});
		chain.executeSync([1], "test");
		expect(order[0]).to.equal("high");
		expect(order[1]).to.equal("low");
	});
	it("abort short-circuits", () => {
		const chain = new MiddlewareChain<[number]>();
		let reached = false;
		chain.use({ priority: 10, name: "stopper", handler: (ctx) => ctx.abort("nope") });
		chain.use({
			priority: 5,
			name: "never",
			handler: (_, proceed) => {
				reached = true;
				proceed();
			},
		});
		const ctx = chain.executeSync([1], "test");
		expect(ctx.isAborted()).to.equal(true);
		expect(reached).to.equal(false);
	});
	it("replace mutates args", () => {
		const chain = new MiddlewareChain<[number]>();
		chain.use({
			priority: 0,
			name: "mutator",
			handler: (ctx, proceed) => {
				ctx.replace([ctx.getArgs()[0] * 2]);
				proceed();
			},
		});
		const ctx = chain.executeSync([5], "test");
		expect(ctx.getArgs()[0]).to.equal(10);
	});
});
describe("rateLimit", () => {
	it("aborts beyond tokens", () => {
		const chain = new MiddlewareChain<[]>();
		chain.use(rateLimit({ perSecond: 1, burst: 1, keyBy: "global" }));
		const a = chain.executeSync([], "t");
		const b = chain.executeSync([], "t");
		expect(a.isAborted()).to.equal(false);
		expect(b.isAborted()).to.equal(true);
	});
});
describe("validate", () => {
	it("rejects wrong types", () => {
		const chain = new MiddlewareChain<[number]>();
		chain.use(validate<[number]>({ schemas: [S.number(0, 100)] }));
		const ok = chain.executeSync([50], "t");
		const bad = chain.executeSync([999 as unknown as number], "t");
		expect(ok.isAborted()).to.equal(false);
		expect(bad.isAborted()).to.equal(true);
	});
});