/// <reference types="@rbxts/types" />
import "../bus.spec";
import "../core.spec";
import "../middleware.spec";
import "../parallel.spec";
import "../reactive.spec";
import "../remote.spec";
import "../scope.spec";

import { ReplicatedStorage } from "@rbxts/services";
import { printReport, runAll, type SuiteReport } from "../harness";
import { runMemoryTests, type MemoryReport } from "./memory";
import { runStress, type StressReport } from "./stress";

type GrandReport = {
	readonly specs: SuiteReport;
	readonly memory: MemoryReport;
	readonly stress: StressReport;
	readonly startedAt: number;
	readonly durationMs: number;
};

task.spawn(() => {
	task.wait(0.25);

	const startedAt = os.time();
	const t0 = os.clock();

	print("");
	print("#######################################################");
	print("#          Omeganet — Studio Test Bench                  #");
	print("#######################################################");
	print(string.format("  Started at: %s", os.date("%Y-%m-%d %H:%M:%S", startedAt)));
	print(string.format("  PlaceVersion: %d", game.PlaceVersion));
	print("");
	print("  Flow: (1) unit tests → (2) memory → (3) stress");
	print("-------------------------------------------------------");

	print("");
	print(">>> (1) UNIT TESTS");
	const specs = runAll();
	printReport(specs);

	print("");
	print(">>> (2) MEMORY");
	const memory = runMemoryTests();

	print("");
	print(">>> (3) STRESS");
	const stress = runStress();

	const durationMs = (os.clock() - t0) * 1000;

	print("");
	print("#######################################################");
	print("#                   GRAND TOTAL                       #");
	print("#######################################################");
	print(
		string.format(
			"  Specs : %3d tests   passed=%-3d  failed=%-3d  %.2f ms",
			specs.total,
			specs.passed,
			specs.failed,
			specs.durationMs,
		),
	);
	print(
		string.format(
			"  Memory: %3d cases   ok=%-3d  over_tol=%-3d  %.2f ms",
			memory.results.size(),
			memory.passed,
			memory.failed,
			memory.durationMs,
		),
	);
	print(
		string.format(
			"  Stress: %3d benches  (wall time incl. yields)  %.2f ms",
			stress.benches.size(),
			stress.durationMs,
		),
	);
	print("  -------------------------------------------------------");
	print(string.format("  Wall-clock total (all suites): %.2f ms", durationMs));

	const hasSpecFailure = specs.failed > 0;
	if (hasSpecFailure) {
		warn(string.format("  [FINAL] FAIL — %d failing spec(s)", specs.failed));
	} else if (memory.failed > 0) {
		warn(
			string.format(
				"  [FINAL] PASS (specs) — %d memory case(s) over advisory threshold",
				memory.failed,
			),
		);
	} else {
		print("  [FINAL] PASS — every suite green");
	}
	print("#######################################################");
	print("  Lua table : _G.OmeganetTestReport  (server only)");
	print("  Text copy : ReplicatedStorage.OmeganetTestReport.Value  (server + client)");
	print("#######################################################");

	const report: GrandReport = {
		specs,
		memory,
		stress,
		startedAt,
		durationMs,
	};
	(_G as unknown as { OmeganetTestReport: GrandReport }).OmeganetTestReport = report;

	const summaryLines: Array<string> = [];
	summaryLines.push(
		string.format(
			"specs: %d passed / %d failed (%.2f ms)",
			specs.passed,
			specs.failed,
			specs.durationMs,
		),
	);
	for (const t of specs.results) {
		if (!t.passed) summaryLines.push(string.format("  FAIL %s > %s", t.suite, t.name));
	}
	summaryLines.push(
		string.format(
			"memory: %d ok / %d high (%.2f ms)",
			memory.passed,
			memory.failed,
			memory.durationMs,
		),
	);
	for (const m of memory.results) {
		summaryLines.push(
			string.format(
				"  %s %s: delta=%+.2f KB (tol %.1f)",
				m.passed ? "OK  " : "HIGH",
				m.name,
				m.deltaKb,
				m.tolerateKb,
			),
		);
	}
	summaryLines.push(string.format("stress: %d benches (%.2f ms)", stress.benches.size(), stress.durationMs));
	for (const b of stress.benches) {
		summaryLines.push(
			string.format("  %s: %d ops in %.2f ms (%.2f us/op)", b.label, b.ops, b.durationMs, b.usPerOp),
		);
	}
	summaryLines.push(string.format("total: %.2f ms", durationMs));

	const existing = ReplicatedStorage.FindFirstChild("OmeganetTestReport");
	if (existing) existing.Destroy();
	const sv = new Instance("StringValue");
	sv.Name = "OmeganetTestReport";
	sv.Value = summaryLines.join("\n");
	sv.Parent = ReplicatedStorage;
});
