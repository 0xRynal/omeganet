import { Signal } from "../src/core/Signal";
import { describe, expect, it } from "./harness";
export const __spec = "core";
describe("Signal", () => {
	it("fires handlers with typed args", () => {
		const s = new Signal<(a: number, b: string) => void>();
		let captured: [number, string] | undefined;
		s.connect((a, b) => {
			captured = [a, b];
		});
		s.fire(42, "ok");
		task.wait();
		expect(captured).to.be.ok();
		expect((captured as unknown as [number, string])[0]).to.equal(42);
		expect((captured as unknown as [number, string])[1]).to.equal("ok");
		s.destroy();
	});
	it("disconnects cleanly", () => {
		const s = new Signal<() => void>();
		let count = 0;
		const conn = s.connect(() => (count += 1));
		s.fire();
		task.wait();
		conn.disconnect();
		s.fire();
		task.wait();
		expect(count).to.equal(1);
		expect(conn.connected).to.equal(false);
		s.destroy();
	});
	it("once only fires once", () => {
		const s = new Signal<() => void>();
		let count = 0;
		s.once(() => (count += 1));
		s.fire();
		s.fire();
		task.wait();
		expect(count).to.equal(1);
		s.destroy();
	});
	it("supports many connections", () => {
		const s = new Signal<(n: number) => void>();
		const calls: Array<number> = [];
		for (let i = 0; i < 10; i++) {
			s.connect((n) => calls.push(i * n));
		}
		s.fire(2);
		task.wait();
		expect(calls.size()).to.equal(10);
		s.destroy();
	});
	it("destroys and rejects new connections", () => {
		const s = new Signal<() => void>();
		s.destroy();
		expect(s.isDestroyed()).to.equal(true);
		const [ok] = pcall(() => s.connect(() => {}));
		expect(ok).to.equal(false);
	});
	it("supports self-disconnect during fire", () => {
		const s = new Signal<(n: number) => void>();
		let fireCount = 0;
		const conn = s.connect(() => {
			fireCount += 1;
			conn.disconnect();
		});
		s.fire(1);
		s.fire(2);
		task.wait();
		expect(fireCount).to.equal(1);
		s.destroy();
	});
	it("getConnectionCount tracks add/remove", () => {
		const s = new Signal<() => void>();
		expect(s.getConnectionCount()).to.equal(0);
		const c1 = s.connect(() => {});
		const c2 = s.connect(() => {});
		expect(s.getConnectionCount()).to.equal(2);
		c1.disconnect();
		expect(s.getConnectionCount()).to.equal(1);
		c2.disconnect();
		expect(s.getConnectionCount()).to.equal(0);
		s.destroy();
	});
	it("sync mode calls handlers inline without yielding", () => {
		const s = new Signal<(n: number) => void>({ sync: true });
		let total = 0;
		s.connect((n) => (total += n));
		s.connect((n) => (total += n * 2));
		s.fire(4);
		expect(total).to.equal(12);
		s.destroy();
	});
	it("sync mode isolates handler errors with pcall", () => {
		const s = new Signal<() => void>({ sync: true });
		let second = 0;
		s.connect(() => {
			error("boom");
		});
		s.connect(() => (second += 1));
		s.fire();
		expect(second).to.equal(1);
		s.destroy();
	});
	it("unsafe sync mode dispatches without pcall overhead", () => {
		const s = new Signal<(n: number) => void>({ sync: true, unsafe: true });
		let total = 0;
		s.connect((n) => (total += n));
		s.connect((n) => (total += n));
		s.connect((n) => (total += n));
		s.fire(5);
		expect(total).to.equal(15);
		s.destroy();
	});
	it("sync fast path fires a single handler without looping", () => {
		const s = new Signal<(n: number) => void>({ sync: true });
		let got = 0;
		s.connect((n) => (got = n));
		s.fire(42);
		expect(got).to.equal(42);
		s.destroy();
	});
	it("sync fire on empty signal is a no-op", () => {
		const s = new Signal<() => void>({ sync: true });
		s.fire();
		expect(s.getConnectionCount()).to.equal(0);
		s.destroy();
	});
});