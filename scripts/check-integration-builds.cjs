/* Production integration builds in a temporary directory; no version bump or docs writes. */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "nunu-integration-build-"));
const runtime = require("../webpack.runtime.js");
const editor = require("../webpack.prod.js");
const editorOnly = process.argv.includes("--editor-only");

function build(config)
{
	return new Promise((resolve, reject) =>
	{
		const compiler = webpack(config);
		compiler.run((error, stats) =>
		{
			compiler.close((closeError) =>
			{
				if (error || closeError) return reject(error || closeError);
				if (stats.hasErrors()) return reject(new Error(stats.toString({all: false, errors: true, errorDetails: true})));
				resolve(stats);
			});
		});
	});
}
function prepare(config, folder)
{
	const result = Object.assign({}, config, {
		output: Object.assign({}, config.output, {path: folder}),
		// Same production minifier, one process: usable on constrained hosts too.
		optimization: Object.assign({}, config.optimization, {minimizer: [new TerserPlugin({parallel: false})]}),
		plugins: (config.plugins || []).filter((plugin) => plugin.constructor.name !== "ProgressPlugin")
	});
	for (const plugin of result.plugins)
	{
		if (plugin.constructor.name === "CopyPlugin")
		{
			plugin.patterns = plugin.patterns.map((pattern) => Object.assign({}, pattern, {to: path.join(folder, "files")}));
		}
	}
	return result;
}
async function main()
{
	for (const config of editorOnly ? [] : runtime)
	{
		const stats = await build(prepare(config, path.join(output, "runtime")));
		const editorModules = Array.from(stats.compilation.modules).filter((module) => module.resource && module.resource.includes(path.join("source", "editor") + path.sep));
		if (editorModules.length) throw new Error("Runtime includes editor modules: " + editorModules.map((module) => module.resource).join(", "));
		console.log("PASS runtime " + config.output.filename + ": no editor source dependencies");
	}
	for (let index = 0; index < (editorOnly ? 1 : editor.length); index++)
	{
		const folder = path.join(output, "editor", index === 0 ? "" : "files/runtime");
		await build(prepare(editor[index], folder));
		console.log("PASS production editor target " + index);
	}
	const css = fs.readFileSync(path.join(output, "editor/styles.css"), "utf8");
	if (!css.includes(".litegraph")) throw new Error("LiteGraph stylesheet missing from production styles.css");
	const html = fs.readFileSync(path.join(output, "editor/index.html"), "utf8");
	if (html.includes('href="litegraph.css"')) throw new Error("HTML references an unbundled stylesheet");
	console.log("PASS LiteGraph CSS packaged in styles.css");
	console.log("Build artifacts: " + output);
}
main().catch((error) =>
{
	console.error(error);
	console.error("Build artifacts: " + output);
	process.exitCode = 1;
});
