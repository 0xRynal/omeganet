
type TestFn = () => void;
type Test = {
	readonly name: string;
	readonly fn: TestFn;
};
type Suite = {
	readonly name: string;
	readonly tests: Array<Test>;
	readonly children: Array<Suite>;
	readonly parent: Suite | undefined;
};
const rootSuite: Suite = {
	name: "<root>",
	tests: [],
	children: [],
	parent: undefined,
};
let currentSuite: Suite = rootSuite;
export function describe(name: string, body: () => void): void {
	const suite: Suite = {
		name,
		tests: [],
		children: [],
		parent: currentSuite,
	};
	currentSuite.children.push(suite);
	const previous = currentSuite;
	currentSuite = suite;
	const [ok, err] = pcall(body);
	currentSuite = previous;
	if (!ok) {
		warn(`[Omeganet Tests] describe("${name}") threw during setup: ${tostring(err)}`);
	}
}
export function it(name: string, fn: TestFn): void {
	currentSuite.tests.push({ name, fn });
}
export type ExpectMatcher<T> = {
	readonly to: {
		equal(expected: T): void;
		near(expected: T, epsilon?: number): void;
		be: {
			ok(): void;
			a(luaTypeName: string): void;
		};
		never: {
			equal(expected: T): void;
			be: {
				ok(): void;
			};
		};
	};
};
function fail(message: string): never {
	error(message, 2);
}
export function expect<T>(actual: T): ExpectMatcher<T> {
	return {
		to: {
			equal(expected: T): void {
				if ((actual as unknown) !== (expected as unknown)) {
					fail(`expected ${tostring(actual)} to equal ${tostring(expected)}`);
				}
			},
			near(expected: T, epsilon = 1e-6): void {
				const a = actual as unknown as number;
				const b = expected as unknown as number;
				if (math.abs(a - b) > epsilon) {
					fail(`expected ${tostring(a)} to be within ${tostring(epsilon)} of ${tostring(b)}`);
				}
			},
			be: {
				ok(): void {
					if (actual === undefined || (actual as unknown) === false) {
						fail(`expected value to be ok, got ${tostring(actual)}`);
					}
				},
				a(luaTypeName: string): void {
					const t = typeOf(actual);
					if (t !== luaTypeName) {
						fail(`expected type "${luaTypeName}", got "${t}"`);
					}
				},
			},
			never: {
				equal(expected: T): void {
					if ((actual as unknown) === (expected as unknown)) {
						fail(`expected value to NOT equal ${tostring(expected)}`);
					}
				},
				be: {
					ok(): void {
						if (actual !== undefined && (actual as unknown) !== false) {
							fail(`expected value to be falsy, got ${tostring(actual)}`);
						}
					},
				},
			},
		},
	};
}
export type TestResult = {
	readonly path: string;
	readonly suite: string;
	readonly name: string;
	readonly passed: boolean;
	readonly error?: string;
	readonly durationMs: number;
};
export type SuiteReport = {
	readonly total: number;
	readonly passed: number;
	readonly failed: number;
	readonly results: ReadonlyArray<TestResult>;
	readonly durationMs: number;
};
function runSuite(suite: Suite, path: string, results: Array<TestResult>): void {
	const prefix = path === "" ? suite.name : `${path} > ${suite.name}`;
	for (const test of suite.tests) {
		const testPath = `${prefix} > ${test.name}`;
		const start = os.clock();
		const [ok, err] = pcall(test.fn);
		const durationMs = (os.clock() - start) * 1000;
		if (ok) {
			results.push({
				path: testPath,
				suite: prefix,
				name: test.name,
				passed: true,
				durationMs,
			});
		} else {
			results.push({
				path: testPath,
				suite: prefix,
				name: test.name,
				passed: false,
				error: tostring(err),
				durationMs,
			});
		}
	}
	for (const child of suite.children) {
		runSuite(child, prefix, results);
	}
}
export function runAll(): SuiteReport {
	const results: Array<TestResult> = [];
	const start = os.clock();
	for (const child of rootSuite.children) {
		runSuite(child, "", results);
	}
	const durationMs = (os.clock() - start) * 1000;
	let passed = 0;
	let failed = 0;
	for (const r of results) {
		if (r.passed) passed += 1;
		else failed += 1;
	}
	return { total: results.size(), passed, failed, results, durationMs };
}
export function resetRegistry(): void {
	rootSuite.tests.clear();
	rootSuite.children.clear();
	currentSuite = rootSuite;
}
function groupBySuite(results: ReadonlyArray<TestResult>): Map<string, Array<TestResult>> {
	const map = new Map<string, Array<TestResult>>();
	for (const r of results) {
		const existing = map.get(r.suite);
		if (existing !== undefined) existing.push(r);
		else map.set(r.suite, [r]);
	}
	return map;
}
export function printReport(report: SuiteReport): void {
	print("");
	print("=======================================================");
	print("  Omeganet — unit tests");
	print("=======================================================");
	print("  [OK]/[FAIL] = suite   (passed count / failed count, total ms for suite)");
	print("  [PASS]/[FAIL] = single test name … duration ms");
	print("-------------------------------------------------------");
	const grouped = groupBySuite(report.results);
	for (const [suite, tests] of grouped) {
		let suitePass = 0;
		let suiteFail = 0;
		let suiteMs = 0;
		for (const t of tests) {
			if (t.passed) suitePass += 1;
			else suiteFail += 1;
			suiteMs += t.durationMs;
		}
		print(
			string.format(
				"  %s  %s  (%d passed / %d failed, %.2f ms)",
				suiteFail === 0 ? "[OK]  " : "[FAIL]",
				suite,
				suitePass,
				suiteFail,
				suiteMs,
			),
		);
		for (const t of tests) {
			const tag = t.passed ? "PASS" : "FAIL";
			print(string.format("        [%s] %-48s %7.2f ms", tag, t.name, t.durationMs));
		}
	}
	const slowest = [...report.results];
	slowest.sort((a, b) => b.durationMs < a.durationMs);
	const slowCount = math.min(5, slowest.size());
	if (slowCount > 0) {
		print("");
		print("  Slowest tests:");
		for (let i = 0; i < slowCount; i++) {
			const r = slowest[i];
			if (r !== undefined) {
				print(string.format("    %2d. %7.2f ms  %s", i + 1, r.durationMs, r.path));
			}
		}
	}
	const failures: Array<TestResult> = [];
	for (const r of report.results) if (!r.passed) failures.push(r);
	if (failures.size() > 0) {
		print("");
		warn("  Failures:");
		for (const f of failures) {
			warn(`    - ${f.path}`);
			if (f.error !== undefined) warn(`        ${f.error}`);
		}
	}
	print("");
	print("  -------------------------------------------------------");
	print(
		string.format(
			"  Total: %d  |  Passed: %d  |  Failed: %d  |  Duration: %.2f ms",
			report.total,
			report.passed,
			report.failed,
			report.durationMs,
		),
	);
	if (report.failed > 0) {
		warn(`  [RESULT] ${report.failed} failing test(s)`);
	} else {
		print("  [RESULT] All specs passed");
	}
	print("=======================================================");
}
