const Path = require("path");

module.exports = {
	include: Path.resolve(__dirname, "source/lib/litegraph/litegraph.mini.js"),
	// Preserve LiteGraph's native browser imports and its guarded Node-only loaders.
	parser: {import: false, commonjs: false}
};
