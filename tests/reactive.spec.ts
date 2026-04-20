import { fromArray, Observable, of } from "../src/reactive/Observable";
import { filter, map, take } from "../src/reactive/operators";
import { BehaviorSubject, Subject } from "../src/reactive/Subject";
import { describe, expect, it } from "./harness";
export const __spec = "reactive";
describe("Observable", () => {
	it("emits values from of()", () => {
		const values: Array<number> = [];
		of(1, 2, 3).subscribe((v) => values.push(v));
		expect(values.size()).to.equal(3);
		expect(values[0]).to.equal(1);
		expect(values[2]).to.equal(3);
	});
	it("pipes through operators", () => {
		const out: Array<number> = [];
		(
			fromArray([1, 2, 3, 4, 5]).pipe(
				filter<number>((n) => n % 2 === 0),
				map<number, number>((n) => n * 10),
			) as Observable<number>
		).subscribe((v) => out.push(v));
		expect(out.size()).to.equal(2);
		expect(out[0]).to.equal(20);
		expect(out[1]).to.equal(40);
	});
	it("take limits emissions", () => {
		const out: Array<number> = [];
		(fromArray([1, 2, 3, 4]).pipe(take<number>(2)) as Observable<number>).subscribe((v) => out.push(v));
		expect(out.size()).to.equal(2);
	});
});
describe("Subject", () => {
	it("multicasts values", () => {
		const subject = new Subject<number>();
		const a: Array<number> = [];
		const b: Array<number> = [];
		subject.subscribe((v) => a.push(v));
		subject.subscribe((v) => b.push(v));
		subject.next(10);
		subject.next(20);
		expect(a.size()).to.equal(2);
		expect(b.size()).to.equal(2);
	});
});
describe("BehaviorSubject", () => {
	it("emits current value to new subscribers via getValue()", () => {
		const bs = new BehaviorSubject(5);
		expect(bs.getValue()).to.equal(5);
		bs.next(10);
		expect(bs.getValue()).to.equal(10);
	});
});