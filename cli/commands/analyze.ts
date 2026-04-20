import * as fs from "fs";
import * as path from "path";
interface Finding {
	readonly file: string;
	readonly line: number;
	readonly severity: "info" | "warn" | "error";
	readonly rule: string;
	readonly message: string;
}
const RULES: ReadonlyArray<{
	readonly id: string;
	readonly pattern: RegExp;
	readonly severity: Finding["severity"];
	readonly message: string;
}> = [
	{
		id: "no-any",
		pattern: /:\s*any\b/,
		severity: "error",
		message: "Avoid `any` — prefer `unknown` + narrowing",
	},
	{
		id: "no-non-null",
		pattern: /![\s.)\]]/,
		severity: "warn",
		message: "Non-null assertion detected — prefer an explicit guard",
	},
	{
		id: "no-typeof-eq",
		pattern: /typeOf\s*\([^)]+\)\s*===/,
		severity: "warn",
		message: "Use `typeIs(value, \"...\")` instead of `typeOf(value) === \"...\"`",
	},
	{
		id: "fire-without-connect",
		pattern: /\.fire\(/,
		severity: "info",
		message: "Signal fire found — make sure matching connect() exists",
	},
	{
		id: "remote-without-validate",
		pattern: /RemoteSignal\s*\(/,
		severity: "info",
		message: "RemoteSignal created — ensure validation middleware is applied on the server",
	},
];
function walk(dir: string, out: string[]): void {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name === "out" || entry.name.startsWith(".")) continue;
			walk(full, out);
		} else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
			out.push(full);
		}
	}
}
export async function runAnalyze(argv: string[]): Promise<number> {
	const target = argv[0] ?? "src";
	if (!fs.existsSync(target)) {
		console.error(`Path does not exist: ${target}`);
		return 1;
	}
	const files: string[] = [];
	const stat = fs.statSync(target);
	if (stat.isDirectory()) walk(target, files);
	else files.push(target);
	const findings: Finding[] = [];
	for (const file of files) {
		const content = fs.readFileSync(file, "utf8");
		const lines = content.split(/\r?\n/);
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			if (line.trimStart().startsWith("//")) continue;
			for (const rule of RULES) {
				if (rule.pattern.test(line)) {
					findings.push({
						file,
						line: i + 1,
						severity: rule.severity,
						rule: rule.id,
						message: rule.message,
					});
				}
			}
		}
	}
	const counts = { info: 0, warn: 0, error: 0 };
	for (const f of findings) counts[f.severity] += 1;
	for (const f of findings) {
		const tag = f.severity.toUpperCase().padEnd(5);
		console.log(`${tag} ${f.file}:${f.line}  [${f.rule}]  ${f.message}`);
	}
	console.log(`\n${findings.length} findings — errors=${counts.error} warns=${counts.warn} infos=${counts.info}`);
	return counts.error > 0 ? 1 : 0;
}