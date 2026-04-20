import { Signal } from "../src/core/Signal";
import { createScope } from "../src/scope/Scope";
import { describe, expect, it } from "./harness";
export const __spec = "scope";
describe("Scope", () => {
	it("disposes tracked Signal connections", () => {
		const scope = createScope();
		const s = new Signal<() => void>({ sync: true });
		let hits = 0;
		const conn = s.connect(() => (hits += 1));
		scope.track(conn);
		s.fire();
		expect(hits).to.equal(1);
		scope.dispose();
		s.fire();
		expect(hits).to.equal(1);
		s.destroy();
	});
	it("destroys owned Signals on dispose", () => {
		const scope = createScope();
		const s = scope.signal<() => void>({ name: "owned", sync: true });
		expect(s.isDestroyed()).to.equal(false);
		scope.dispose();
		expect(s.isDestroyed()).to.equal(true);
	});
	it("runs teardown callbacks in reverse order", () => {
		const scope = createScope();
		const order: Array<number> = [];
		scope.track(() => order.push(1));
		scope.track(() => order.push(2));
		scope.track(() => order.push(3));
		scope.dispose();
		expect(order[0]).to.equal(3);
		expect(order[1]).to.equal(2);
		expect(order[2]).to.equal(1);
	});
	it("child scopes dispose before parent", () => {
		const parent = createScope();
		const child = parent.child();
		let childDisposed = false;
		child.track(() => (childDisposed = true));
		parent.dispose();
		expect(childDisposed).to.equal(true);
	});
	it("track() on disposed scope runs teardown immediately", () => {
		const scope = createScope();
		scope.dispose();
		let ran = false;
		scope.track(() => (ran = true));
		expect(ran).to.equal(true);
	});
});