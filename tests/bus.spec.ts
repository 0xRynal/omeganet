import { createEventBus } from "../src/bus/EventBus";
import { describe, expect, it } from "./harness";
export const __spec = "bus";
type Events = {
	ping: [number];
	greet: [who: string, age: number];
	empty: [];
};
describe("EventBus", () => {
	it("routes emit -> on by key with strong typing", () => {
		const bus = createEventBus<Events>({ sync: true });
		let pinged = 0;
		bus.on("ping", (n) => {
			pinged += n;
		});
		bus.emit("ping", 5);
		bus.emit("ping", 3);
		expect(pinged).to.equal(8);
		bus.clear();
	});
	it("once disconnects after first emission", () => {
		const bus = createEventBus<Events>({ sync: true });
		let calls = 0;
		bus.once("greet", () => (calls += 1));
		bus.emit("greet", "Alice", 30);
		bus.emit("greet", "Bob", 25);
		expect(calls).to.equal(1);
		expect(bus.listenerCount("greet")).to.equal(0);
		bus.clear();
	});
	it("off(event) removes only that event's handlers", () => {
		const bus = createEventBus<Events>({ sync: true });
		bus.on("ping", () => {});
		bus.on("greet", () => {});
		expect(bus.listenerCount("ping")).to.equal(1);
		expect(bus.listenerCount("greet")).to.equal(1);
		bus.off("ping");
		expect(bus.listenerCount("ping")).to.equal(0);
		expect(bus.listenerCount("greet")).to.equal(1);
		bus.clear();
	});
	it("emit to unknown event is a no-op", () => {
		const bus = createEventBus<Events>({ sync: true });
		bus.emit("empty");
		bus.clear();
	});
});