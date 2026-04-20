/**
 * Removes stale compiler output dirs from older layouts (folder renames).
 * Prevents overwriting source when output paths collide.
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
for (const stale of [path.join(root, "out", "ai"), path.join(root, "test-out", "src", "ai")]) {
	try {
		fs.rmSync(stale, { recursive: true, force: true });
	} catch {
		// ignore
	}
}
