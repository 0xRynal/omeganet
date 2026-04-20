import { Collector } from "../devtools/Collector";
import { defaultRules } from "./rules";
import type { Rule } from "./rules";
import type { Suggestion } from "./Suggestion";
export type HintProvider = {
	ask(context: string, stats: ReadonlyArray<Suggestion>): Promise<string>;
};
export type HeuristicRuntime = {
	analyze(): ReadonlyArray<Suggestion>;
	addRule(rule: Rule): void;
	setProvider(provider: HintProvider): void;
	(context: string): Promise<string>;
};
const rules: Array<Rule> = [...defaultRules];
let provider: HintProvider | undefined;
function analyze(): ReadonlyArray<Suggestion> {
	const out: Array<Suggestion> = [];
	for (const stats of Collector.getAllStats()) {
		for (const rule of rules) {
			const s = rule(stats);
			if (s !== undefined) out.push(s);
		}
	}
	return out;
}
function addRule(rule: Rule): void {
	rules.push(rule);
}
function setProvider(p: HintProvider): void {
	provider = p;
}
function call(context: string): Promise<string> {
	const current = analyze();
	if (provider !== undefined) return provider.ask(context, current);
	const lines = current.map((s) => `  [${s.severity}] ${s.rule}: ${s.message}`);
	const body = lines.size() > 0 ? lines.join("\n") : "  (no suggestions — traffic is within thresholds)";
	const label = context !== "" ? ` — ${context}` : "";
	return Promise.resolve(
		`[Omeganet/Algo] No hint provider configured${label}.\n` +
			`Suggestions (${current.size()}):\n` +
			body,
	);
}
const fn = ((context: string) => call(context)) as HeuristicRuntime;
fn.analyze = analyze;
fn.addRule = addRule;
fn.setProvider = setProvider;
export const HeuristicAnalyzer: HeuristicRuntime = fn;
