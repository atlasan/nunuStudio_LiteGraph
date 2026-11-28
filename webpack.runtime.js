const Path = require("path");
const Webpack = require("webpack");
const liteGraph = require("./webpack.litegraph.js");

const source = Path.resolve(__dirname, "source");
const output = Path.resolve(__dirname, "dist");

const config = {
	context: source,
	entry: source + "/core/Main.js",
	target: "web",
	// URL imports are not left as externals, so the CDN import of opentype.js can be replaced by the local package
	externalsPresets: {web: false},
	devtool: false,
	// Force a single three.js instance, some dependencies (spine-threejs) ship their own copy
	resolve: {alias: {three$: Path.resolve(__dirname, "node_modules/three/build/three.module.js")}},
	mode: "production",
	optimization: {minimize: true},
	performance: {
		hints: false,
	},
	plugins: [
		// three.js TTFLoader imports opentype.js from a CDN, bundle the local package instead (works offline)
		new Webpack.NormalModuleReplacementPlugin(/^https:\/\/cdn\.jsdelivr\.net\/npm\/opentype\.js@[^/]+\/\+esm$/, "opentype.js"),
		new Webpack.ProvidePlugin({
			THREE: "three",
			"window.THREE": "three"
		}),
		// Used by the core when serializing (e.g. Object3D.toJSON), the editor build defines its own
		new Webpack.DefinePlugin({
			"VERSION": JSON.stringify(require("./package.json").version)
		})
	],
	module: {
		// Importing a name a module does not export (e.g. removed three.js APIs) is a build error
		parser: {javascript: {exportsPresence: "error"}},
		rules: [
			liteGraph,
			{
				test: /\.glsl$/i,
				use: "raw-loader"
			},
			{
				test: /.*brython.*/,
				loader: "@shoutem/webpack-prepend-append",
				options: JSON.stringify({
					prepend: `(function (root, factory) {
						if (typeof define === 'function' && define.amd) { define([], factory); }  // AMD loader
						else if (typeof module === 'object' && module.exports) { module.exports = factory(); }  // CommonJS loader
						else { root.brython = factory(); }  // Script tag
						}(typeof self !== 'undefined' ? self : this, function () {
						var process = {release: {name: ''}};`,
					append: `window.__BRYTHON__ = __BRYTHON__;
						return __BRYTHON__;
						}));`
				})
			}
		]
	}
};

module.exports = [
	Object.assign({
		output: {
			hashFunction: "sha256",
			filename: "nunu.min.js",
			path: output,
			library: "Nunu",
			libraryTarget: "umd"
		}
	}, config),
	Object.assign({
		output: {
			hashFunction: "sha256",
			filename: "nunu.module.min.js",
			path: output,
			libraryTarget: "umd"
		}
	}, config)
];
