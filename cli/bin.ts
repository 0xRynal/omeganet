#!/usr/bin/env node
import { runGenerate } from "./commands/generate";
import { runAnalyze } from "./commands/analyze";
const COMMANDS: Record<string, (argv: string[]) => Promise<number> | number> = {
	generate: runGenerate,
	g: runGenerate,
	analyze: runAnalyze,
};
function printHelp(): void {
	console.log(`Omeganet CLI
Usage:
  omeganet <command> [options]
Commands:
  generate, g <type> <Name>   Scaffold a signal, middleware, or service
  analyze [path]              Static lint for signal usage patterns
Examples:
  omeganet generate signal PlayerDamage
  omeganet generate middleware MyGuard
  omeganet analyze src/
`);
}
async function main(): Promise<number> {
	const [, , command, ...rest] = process.argv;
	if (command === undefined || command === "--help" || command === "-h") {
		printHelp();
		return 0;
	}
	const handler = COMMANDS[command];
	if (handler === undefined) {
		console.error(`Unknown command: ${command}`);
		printHelp();
		return 1;
	}
	return await handler(rest);
}
main().then(
	(code) => process.exit(code),
	(err: unknown) => {
		console.error(err);
		process.exit(1);
	},
);
