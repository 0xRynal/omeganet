const fs = require("fs");
const path = require("path");
const ts = require("typescript");

function stripComments(text) {
	const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
	const ranges = [];
	let token = scanner.scan();
	while (token !== ts.SyntaxKind.EndOfFileToken) {
		if (
			token === ts.SyntaxKind.SingleLineCommentTrivia ||
			token === ts.SyntaxKind.MultiLineCommentTrivia
		) {
			const start = scanner.getTokenFullStart();
			const end = scanner.getTextPos();
			const chunk = text.slice(start, end);
			if (/^\/{3}\s*<reference\b/.test(chunk)) {
				token = scanner.scan();
				continue;
			}
			ranges.push([start, end]);
		}
		token = scanner.scan();
	}
	ranges.sort((a, b) => b[0] - a[0]);
	let s = text;
	for (const [start, end] of ranges) {
		s = s.slice(0, start) + s.slice(end);
	}
	return s
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.replace(/^\s+$/gm, "");
}

const roots = [
	path.join(__dirname, "..", "src"),
	path.join(__dirname, "..", "cli"),
	path.join(__dirname, "..", "tests"),
];

function walk(dir, acc) {
	if (!fs.existsSync(dir)) return;
	for (const name of fs.readdirSync(dir)) {
		const p = path.join(dir, name);
		const st = fs.statSync(p);
		if (st.isDirectory()) walk(p, acc);
		else if (name.endsWith(".ts")) acc.push(p);
	}
}

const files = [];
for (const r of roots) walk(r, files);

for (const f of files) {
	const raw = fs.readFileSync(f, "utf8");
	const next = stripComments(raw);
	if (next !== raw) fs.writeFileSync(f, next, "utf8");
}
