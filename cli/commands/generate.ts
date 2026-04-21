import * as fs from "fs";
import * as path from "path";
const SIGNAL_TEMPLATE = (name: string) => `import { Omeganet } from "@rbxts/omeganet";
export type ${name}Handler = (player: Player, amount: number) => void;
export const ${name}Signal = Omeganet.Omega.create<${name}Handler>({
	name: "${name}",
	mode: "auto",
	reliability: "reliable",
	batch: false,
});
`;
const MIDDLEWARE_TEMPLATE = (name: string) => `import { MiddlewareEntry, MiddlewareHandler } from "@rbxts/omeganet";
export interface ${name}Options {
	readonly priority?: number;
}
export function ${name.substring(0, 1).toLowerCase() + name.substring(1)}(options: ${name}Options = {}): MiddlewareEntry {
	const handler: MiddlewareHandler = (ctx, proceed) => {
		proceed();
	};
	return {
		priority: options.priority ?? 50,
		name: "${name}",
		handler,
	};
}
`;
const SERVICE_TEMPLATE = (name: string) => `import { Service, OnStart } from "@flamework/core";
import { Omeganet } from "@rbxts/omeganet";
@Service()
export class ${name} implements OnStart {
	private readonly signal = Omeganet.Omega.create<(player: Player) => void>({
		name: "${name}_event",
		mode: "remote",
	});
	onStart(): void {
		this.signal.connect((player) => {
			print(\`\${player.Name} triggered ${name}\`);
		});
	}
}
`;
export async function runGenerate(argv: string[]): Promise<number> {
	const [kind, rawName, ...rest] = argv;
	const outDir = rest.find((a) => a.startsWith("--out="))?.slice(6) ?? "src/generated";
	if (kind === undefined || rawName === undefined) {
		console.error("Usage: omeganet generate <signal|middleware|service> <Name> [--out=dir]");
		return 1;
	}
	const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
	const map: Record<string, { template: (n: string) => string; file: string }> = {
		signal: { template: SIGNAL_TEMPLATE, file: `${name}.ts` },
		middleware: { template: MIDDLEWARE_TEMPLATE, file: `${name}.ts` },
		service: { template: SERVICE_TEMPLATE, file: `${name}.ts` },
	};
	const cfg = map[kind];
	if (cfg === undefined) {
		console.error(`Unknown kind: ${kind}. Expected: signal | middleware | service`);
		return 1;
	}
	fs.mkdirSync(outDir, { recursive: true });
	const filePath = path.join(outDir, cfg.file);
	if (fs.existsSync(filePath)) {
		console.error(`File already exists: ${filePath}`);
		return 1;
	}
	fs.writeFileSync(filePath, cfg.template(name), "utf8");
	console.log(`Created ${filePath}`);
	return 0;
}
