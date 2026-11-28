/**
 * Dev server used by the browser tests.
 *
 * Builds editor and runtime in memory (nothing is written to docs/editor) and serves:
 *  /              editor (in memory bundle, static files from docs/editor)
 *  /files/runtime/nunu.min.js   runtime (in memory, always fresh, unlike the committed docs/editor/files/runtime copy)
 *  /examples/     example projects from docs/examples
 *  /harness/      test pages
 *  /cache/        files prepared by the test setup (e.g. the master runtime)
 */
const Path = require("path");
const dev = require("../webpack.dev.js");

const root = Path.resolve(__dirname, "..");
const port = Number(process.env.NUNU_TEST_PORT || 8090);

module.exports = dev.map((config, index) =>
{
	if (index !== 0)
	{
		return config;
	}

	return Object.assign({}, config, {
		plugins: config.plugins.filter((plugin) => plugin.constructor.name !== "HotModuleReplacementPlugin"),
		devServer: {
			port: port,
			hot: false,
			liveReload: false,
			open: false,
			client: false,
			compress: false,
			static: [
				{directory: Path.join(root, "docs/editor"), watch: false},
				{directory: Path.join(root, "docs/examples"), publicPath: "/examples", watch: false},
				{directory: Path.join(root, "test/harness"), publicPath: "/harness", watch: false},
				{directory: Path.join(root, "test/.cache"), publicPath: "/cache", watch: false}
			]
		}
	});
});
