import type { Compressor } from "./types";
export const rleCompressor: Compressor = {
	name: "rle",
	compress(payload: ReadonlyArray<unknown>): unknown {
		if (payload.size() === 0) return payload;
		const out: Array<defined> = [];
		let runValue: defined = (payload[0] as defined) ?? (0 as defined);
		let runCount = 1;
		for (let i = 1; i < payload.size(); i++) {
			const v = payload[i] as defined;
			if (v === runValue && runCount < 255) {
				runCount += 1;
			} else {
				out.push(runCount, runValue);
				runValue = v;
				runCount = 1;
			}
		}
		out.push(runCount, runValue);
		return out;
	},
	decompress(payload: unknown): ReadonlyArray<unknown> {
		if (!typeIs(payload, "table")) return [];
		const arr = payload as Array<defined>;
		const out: Array<defined> = [];
		let i = 0;
		while (i < arr.size()) {
			const count = arr[i];
			const value = arr[i + 1];
			if (!typeIs(count, "number")) break;
			for (let j = 0; j < count; j++) out.push(value as defined);
			i += 2;
		}
		return out;
	},
};
export const noCompressor: Compressor = {
	name: "none",
	compress(p: ReadonlyArray<unknown>): unknown {
		return p;
	},
	decompress(p: unknown): ReadonlyArray<unknown> {
		return typeIs(p, "table") ? (p as ReadonlyArray<unknown>) : [];
	},
};