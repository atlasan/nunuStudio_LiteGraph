/* Refresh the vendored browser distribution without modifying the source checkout. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const {execFileSync} = require("node:child_process");

const repo = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const source = path.resolve(args.find((arg) => !arg.startsWith("--")) || path.join(repo, "../litegraph.js"));
const rebuild = args.includes("--rebuild");
function git(...params)
{
	return execFileSync("git", ["-C", source, ...params], {encoding: "utf8", env: Object.assign({}, process.env, {GIT_OPTIONAL_LOCKS: "0"})}).trimEnd();
}
function hash(file)
{
	return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
const status = git("status", "--porcelain");
const revision = git("rev-parse", "HEAD");
const branch = git("branch", "--show-current");
let snapshot;
try
{
	let distribution = source;
	if (rebuild)
	{
		snapshot = fs.mkdtempSync(path.join(os.tmpdir(), "nunu-litegraph-"));
		for (const entry of ["src", "css", "build.py", "package.json", "LICENSE"])
		{
			fs.cpSync(path.join(source, entry), path.join(snapshot, entry), {recursive: true});
		}
		fs.symlinkSync(path.join(source, "node_modules"), path.join(snapshot, "node_modules"), "dir");
		execFileSync("python3", [path.join(snapshot, "build.py")], {stdio: "inherit"});
		distribution = snapshot;
	}
	const files = {
		"litegraph.js": path.join(distribution, "build/litegraph.js"),
		"litegraph.css": path.join(distribution, "css/litegraph.css"),
		"litegraph.LICENSE": path.join(distribution, "LICENSE")
	};
	const hashes = {};
	for (const [name, file] of Object.entries(files))
	{
		fs.copyFileSync(file, path.join(repo, "source/lib", name));
		fs.chmodSync(path.join(repo, "source/lib", name), 0o644);
		hashes[name] = hash(file);
	}
	const inputs = {};
	function collect(dir)
	{
		for (const entry of fs.readdirSync(path.join(distribution, dir), {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name)))
		{
			const file = path.posix.join(dir, entry.name);
			if (entry.isDirectory()) collect(file);
			else inputs[file] = hash(path.join(distribution, file));
		}
	}
	collect("src");
	collect("css");
	inputs["build.py"] = hash(path.join(distribution, "build.py"));
	const metadata = {
		repository: "https://github.com/atlasan/litegraph.js.git",
		revision: revision,
		branch: branch,
		version: JSON.parse(fs.readFileSync(path.join(distribution, "package.json"))).version,
		sourceDirty: status !== "",
		sourceStatus: status.split("\n").filter(Boolean),
		rebuiltFromSource: rebuild,
		inputDigest: crypto.createHash("sha256").update(JSON.stringify(inputs)).digest("hex"),
		files: hashes
	};
	fs.writeFileSync(path.join(repo, "source/lib/litegraph.provenance.json"), JSON.stringify(metadata, null, "\t") + "\n");
	console.log("Synced LiteGraph " + metadata.version + " at " + revision + (metadata.sourceDirty ? (rebuild ? " (dirty source rebuilt in snapshot)" : " (dirty source; existing builds copied)") : ""));
}
finally
{
	if (snapshot) fs.rmSync(snapshot, {recursive: true, force: true});
}
