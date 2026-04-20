import { SharedState } from "../src/parallel/SharedState";
import { describe, expect, it } from "./harness";
export const __spec = "parallel";
describe("SharedState", () => {
	it("stores and retrieves values", () => {
		const state = new SharedState<{ score: number }>({
			name: "test",
			initial: { score: 0 },
		});
		state.set("score", 42, "writerA");
		expect(state.get("score")).to.equal(42);
		expect(state.getVersion("score")).to.equal(1);
		state.destroy();
	});
	it("notifies subscribers on change", () => {
		const state = new SharedState<{ hp: number }>({
			name: "test2",
			initial: { hp: 100 },
		});
		let received: unknown;
		state.subscribe<number>("hp", (value) => {
			received = value;
		});
		state.set("hp", 50);
		expect(received).to.equal(50);
		state.destroy();
	});
});