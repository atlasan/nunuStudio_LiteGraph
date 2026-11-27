#!/usr/bin/env node
/**
 * Fast static checks for source/core and source/editor (no build, no browser).
 *
 * Catches the classes of bugs found while moving to ES6 classes and newer three.js:
 *  - files that do not parse
 *  - derived class constructors that use `this` before `super()` or never call it
 *  - ES5 style `Parent.call(this)` / `X.prototype = ...` on ES6 classes
 *  - `super.method(arguments)` (passes the arguments object as one value)
 *  - imports of names that the target module (or three.js) does not export
 *  - undefined identifiers that are not in the known baseline
 *
 * Usage: node test/static/check.mjs [--update-baseline]
 */
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));
// webpack's acorn is the parser that actually builds the project
const acorn = require(require.resolve("acorn", {paths: [path.dirname(require.resolve("webpack"))]}));
const walk = require(require.resolve("acorn-walk", {paths: [path.dirname(require.resolve("webpack"))]}));
const {ESLint} = require("eslint");

const baselineFile = path.join(root, "test/static/undefined-baseline.json");
const allowNoSuper = "static-check: allow-no-super";
const dirs = ["source/core", "source/editor"];

const files = dirs.flatMap((d) => fs.readdirSync(path.join(root, d), {recursive: true})
	.filter((f) => f.endsWith(".js"))
	.map((f) => path.join(root, d, f)));
const rel = (f) => path.relative(root, f);
const problems = [];
const report = (file, node, message) => problems.push(`${rel(file)}:${node?.loc?.start.line ?? 0} ${message}`);

// Parse everything once
const asts = new Map();
for (const file of files)
{
	try
	{
		asts.set(file, acorn.parse(fs.readFileSync(file, "utf8"), {ecmaVersion: "latest", sourceType: "module", locations: true}));
	}
	catch (e)
	{
		problems.push(`${rel(file)}:${e.loc?.line ?? 0} syntax error: ${e.message}`);
	}
}

// Class names known to be ES6 classes: project classes and three.js classes
const three = await import(require.resolve("three"));
const threeExports = new Set(Object.keys(three));
const classNames = new Set(Object.keys(three).filter((k) => typeof three[k] === "function" && /^class\b/.test(Function.prototype.toString.call(three[k]))));
for (const ast of asts.values())
{
	walk.simple(ast, {ClassDeclaration: (n) => n.id && classNames.add(n.id.name)});
}

// Exported names of every project module, following `export * from`
const exportCache = new Map();
function exportsOf(file, seen = new Set())
{
	if (exportCache.has(file)) {return exportCache.get(file);}
	if (seen.has(file) || !asts.has(file)) {return null;}
	seen.add(file);
	const names = new Set();
	for (const n of asts.get(file).body)
	{
		if (n.type === "ExportNamedDeclaration")
		{
			n.specifiers.forEach((s) => names.add(s.exported.name));
			if (n.declaration?.id) {names.add(n.declaration.id.name);}
			n.declaration?.declarations?.forEach((d) => d.id.name && names.add(d.id.name));
		}
		else if (n.type === "ExportDefaultDeclaration") {names.add("default");}
		else if (n.type === "ExportAllDeclaration" && !n.exported)
		{
			const target = exportsOf(path.resolve(path.dirname(file), n.source.value), seen);
			if (target === null) {return null;}
			target.forEach((x) => names.add(x));
		}
	}
	exportCache.set(file, names);
	return names;
}

for (const [file, ast] of asts)
{
	const code = fs.readFileSync(file, "utf8");
	const localClasses = new Set(ast.body.filter((n) => n.type === "ClassDeclaration").map((n) => n.id.name));

	walk.full(ast, (node) =>
	{
		// Derived constructors
		if ((node.type === "ClassDeclaration" || node.type === "ClassExpression") && node.superClass)
		{
			const ctor = node.body.body.find((m) => m.kind === "constructor");
			if (!ctor || code.slice(ctor.start, ctor.end).includes(allowNoSuper)) {return;}
			let superAt = Infinity, thisAt = Infinity;
			walk.full(ctor.value.body, (n) =>
			{
				if (n.type === "CallExpression" && n.callee.type === "Super") {superAt = Math.min(superAt, n.start);}
				if (n.type === "ThisExpression") {thisAt = Math.min(thisAt, n.start);}
			});
			if (superAt === Infinity) {report(file, ctor, `${node.id?.name}: constructor never calls super()`);}
			else if (thisAt < superAt) {report(file, ctor, `${node.id?.name}: uses this before super()`);}
		}

		// Parent.call(this) / Parent.apply(this) on an ES6 class
		if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && node.callee.object.type === "Identifier" &&
			["call", "apply"].includes(node.callee.property.name) && node.arguments[0]?.type === "ThisExpression" && classNames.has(node.callee.object.name))
		{
			report(file, node, `${node.callee.object.name}.${node.callee.property.name}(this) on an ES6 class, use extends/super()`);
		}

		// super.method(arguments)
		if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && node.callee.object.type === "Super" &&
			node.arguments.length === 1 && node.arguments[0].type === "Identifier" && node.arguments[0].name === "arguments")
		{
			report(file, node, "super call passes the arguments object, use ...arguments");
		}

		// X.prototype = ... on a class (TypeError in module code)
		if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression" && node.left.property.name === "prototype" &&
			node.left.object.type === "Identifier" && localClasses.has(node.left.object.name))
		{
			report(file, node, `assigns ${node.left.object.name}.prototype on a class`);
		}
	});

	// Imported names must exist
	for (const n of ast.body.filter((x) => x.type === "ImportDeclaration" || (x.type === "ExportNamedDeclaration" && x.source)))
	{
		const source = n.source.value;
		const names = n.specifiers.filter((s) => s.type === "ImportSpecifier" || s.type === "ExportSpecifier").map((s) => (s.imported ?? s.local).name);
		if (source === "three")
		{
			names.filter((x) => !threeExports.has(x)).forEach((x) => report(file, n, `three.js does not export ${x}`));
		}
		else if (source.startsWith("three/"))
		{
			const target = path.join(root, "node_modules", source.endsWith(".js") ? source : source + ".js");
			if (!fs.existsSync(target)) {report(file, n, `missing three.js module ${source}`);}
		}
		else if (source.startsWith("."))
		{
			const base = path.resolve(path.dirname(file), source);
			const target = [base, base + ".js", path.join(base, "index.js")].find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
			if (!target) {report(file, n, `missing module ${source}`); continue;}
			const exported = exportsOf(target);
			exported && names.filter((x) => !exported.has(x)).forEach((x) => report(file, n, `${source} does not export ${x}`));
		}
	}
}

// Undefined identifiers, compared to a baseline of known pre-existing ones
const eslint = new ESLint({
	cwd: root,
	useEslintrc: false,
	overrideConfig: {
		parserOptions: {ecmaVersion: 2020, sourceType: "module"},
		env: {browser: true, es2020: true},
		globals: Object.fromEntries(["THREE", "VERSION", "TIMESTAMP", "DEVELOPMENT", "REPOSITORY_BRANCH", "REPOSITORY_COMMIT", "CodeMirror", "Buffer", "tern"].map((g) => [g, "readonly"])),
		rules: {"no-undef": "error"}
	}
});
const undefinedNames = [...new Set((await eslint.lintFiles(dirs)).flatMap((r) => r.messages
	.filter((m) => m.ruleId === "no-undef")
	.map((m) => `${rel(r.filePath)}: ${m.message.match(/'(.+)'/)[1]}`)))].sort();

if (process.argv.includes("--update-baseline"))
{
	fs.writeFileSync(baselineFile, JSON.stringify(undefinedNames, null, "\t") + "\n");
	console.log(`Baseline updated with ${undefinedNames.length} known undefined names.`);
}
else
{
	const baseline = new Set(fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, "utf8")) : []);
	undefinedNames.filter((x) => !baseline.has(x)).forEach((x) => problems.push(`${x} is not defined (not in baseline)`));
}

if (problems.length > 0)
{
	console.error(problems.join("\n"));
	console.error(`\n${problems.length} static problem(s) in ${files.length} files.`);
	process.exit(1);
}
console.log(`Static checks passed (${files.length} files).`);
