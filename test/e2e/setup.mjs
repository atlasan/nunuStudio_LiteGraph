import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";

/**
 * Extract the runtime committed on a reference branch, used to render the visual baselines.
 *
 * No build needed: the published runtime is tracked in docs/editor/files/runtime.
 */
export default function setup()
{
	const ref = process.env.NUNU_BASELINE_REF || "master";
	const file = path.resolve("test/.cache/baseline/nunu.min.js");
	fs.mkdirSync(path.dirname(file), {recursive: true});
	fs.writeFileSync(file, execFileSync("git", ["show", `${ref}:docs/editor/files/runtime/nunu.min.js`], {maxBuffer: 64 * 1024 * 1024}));
}
