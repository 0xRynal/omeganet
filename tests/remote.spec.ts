import { rleCompressor } from "../src/remote/Compressor";
import { Reconciler } from "../src/remote/Reconciler";
import { S } from "../src/remote/Validator";
import { describe, expect, it } from "./harness";
export const __spec = "remote";
describe("rleCompressor", () => {
	it("round-trips identical runs", () => {
		const payload = [1, 1, 1, 2, 2, 3];
		const compressed = rleCompressor.compress(payload);
		const decompressed = rleCompressor.decompress(compressed);
		expect(decompressed.size()).to.equal(payload.size());
		for (let i = 0; i < payload.size(); i++) {
			expect(decompressed[i]).to.equal(payload[i]);
		}
	});
});
describe("Reconciler", () => {
	it("replays pending inputs after reconcile", () => {
		const r = new Reconciler<number, number>({
			initialState: 0,
			apply: (s, input) => s + input,
		});
		r.predict(1, 0);
		r.predict(2, 0);
		r.predict(3, 0);
		r.reconcile(0, -1);
		expect(r.getState()).to.equal(6);
		expect(r.pendingCount()).to.equal(3);
	});
	it("drops processed inputs", () => {
		const r = new Reconciler<number, number>({
			initialState: 0,
			apply: (s, input) => s + input,
		});
		r.predict(5, 0);
		r.predict(10, 0);
		r.reconcile(5, 0);
		expect(r.getState()).to.equal(15);
		expect(r.pendingCount()).to.equal(1);
	});
});
describe("S schema", () => {
	it("safeParse returns success flag", () => {
		const result = S.number(0, 10).safeParse?.(5);
		expect(result?.success).to.equal(true);
	});
	it("safeParse reports failure", () => {
		const result = S.number(0, 10).safeParse?.(999);
		expect(result?.success).to.equal(false);
	});
});