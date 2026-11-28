const Fs = require("fs");
const Path = require("path");
const Webpack = require("webpack");
const liteGraph = require("./webpack.litegraph.js");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MergeIntoSingleFilePlugin = require("webpack-merge-and-include-globally");
const CopyPlugin = require("copy-webpack-plugin");
const {merge} = require("webpack-merge");
const runtime = require("./webpack.runtime.js");

const source = Path.resolve(__dirname, "source");
const output = Path.resolve(__dirname, "docs/editor");
const websiteExamples = Path.resolve(__dirname, "docs/examples");
const editorExamples = Path.join(source, "files/examples");

function listProjects(directory)
{
	return Fs.existsSync(directory) ? Fs.readdirSync(directory, {withFileTypes: true})
		.filter((entry) => entry.isFile() && /\.(isp|nsp)$/i.test(entry.name))
		.map((entry) => entry.name) : [];
}

const localProjects = new Set(listProjects(editorExamples));
const websiteProjects = listProjects(websiteExamples).filter((name) => !localProjects.has(name));
const bundledProjects = [...localProjects, ...websiteProjects].sort();

module.exports = [
	{
		context: source,
		entry: source + "/editor/Main.js",
		target: "web",
		// URL imports are not left as externals, so the CDN import of opentype.js can be replaced by the local package
		externalsPresets: {web: false},
		devtool: false,
		// Force a single three.js instance, some dependencies (spine-threejs) ship their own copy
		resolve: {alias: {three$: Path.resolve(__dirname, "node_modules/three/build/three.module.js")}},
		performance: {
			hints: false,
		},
		module: {
			// Importing a name a module does not export (e.g. removed three.js APIs) is a build error
			parser: {javascript: {exportsPresence: "error"}},
			rules: [
				liteGraph,
				{test: /litegraph\.css$/, use: ["style-loader", "css-loader"]},
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
		},
		output: {
			hashFunction: "sha256",
			filename: "bundle.js",
			path: output
		},
		plugins: [
			// three.js TTFLoader imports opentype.js from a CDN, bundle the local package instead (works offline)
			new Webpack.NormalModuleReplacementPlugin(/^https:\/\/cdn\.jsdelivr\.net\/npm\/opentype\.js@[^/]+\/\+esm$/, "opentype.js"),
			new CopyPlugin({
				patterns: [
					{
						from: source + "/files",
						to: output + "/files",
						force: true
					},
					...websiteProjects.map((name) => ({
						from: Path.join(websiteExamples, name),
						to: Path.join(output, "files/examples", name)
					}))
				],
				options: {concurrency: 100}
			}),
			new Webpack.DefinePlugin({BUNDLED_PROJECTS: JSON.stringify(bundledProjects)}),
			new HtmlWebpackPlugin({template: source + "/editor/index.html", filename: "index.html", hash: true}),
			new Webpack.ProgressPlugin(),
			new Webpack.ProvidePlugin({
				THREE: "three",
				"window.THREE": "three"
			}),
			new MergeIntoSingleFilePlugin({
				files: {
					"package.json": [
						"package.json"
					],
					"styles.css": [
						"source/editor/style.css",
						"source/editor/theme/dark.css"
					],
					"draco_encoder.js": [
						"source/lib/draco_encoder.js"
					],
					"jshint.js": [
						"node_modules/jshint/dist/jshint.js"
					],
					"acorn.js": [
						"node_modules/acorn/dist/acorn.js",
						"node_modules/acorn-loose/dist/acorn-loose.js",
						"node_modules/acorn-walk/dist/walk.js"
					],
					"tern.js": [
						"node_modules/tern/lib/signal.js",
						"node_modules/tern/lib/tern.js",
						"node_modules/tern/lib/def.js",
						"node_modules/tern/lib/comment.js",
						"node_modules/tern/lib/infer.js",
						"node_modules/tern/plugin/doc_comment.js"
					],
					"codemirror.js": [
						"node_modules/codemirror/lib/codemirror.js",
						"node_modules/codemirror/keymap/sublime.js",
						"node_modules/codemirror/keymap/emacs.js",
						"node_modules/codemirror/keymap/vim.js",
						"node_modules/codemirror/mode/python/python.js",
						"node_modules/codemirror/mode/javascript/javascript.js",
						"node_modules/codemirror/mode/css/css.js",
						"node_modules/codemirror/mode/xml/xml.js",
						"node_modules/codemirror/mode/htmlmixed/htmlmixed.js",
						"node_modules/codemirror/addon/edit/closebrackets.js",
						"node_modules/codemirror/addon/edit/matchbrackets.js",
						"node_modules/codemirror/addon/scroll/annotatescrollbar.js",
						"node_modules/codemirror/addon/search/search.js",
						"node_modules/codemirror/addon/search/searchcursor.js",
						"node_modules/codemirror/addon/search/jump-to-line.js",
						"node_modules/codemirror/addon/search/match-highlighter.js",
						"node_modules/codemirror/addon/search/matchesonscrollbar.js",
						"node_modules/codemirror/addon/hint/show-hint.js",
						"node_modules/codemirror/addon/hint/anyword-hint.js",
						"node_modules/codemirror/addon/dialog/dialog.js",
						"node_modules/codemirror/addon/selection/mark-selection.js",
						"node_modules/codemirror/addon/selection/active-line.js",
						"node_modules/codemirror/addon/selection/selection-pointer.js",
						"node_modules/codemirror/addon/lint/lint.js",
						"node_modules/codemirror/addon/lint/javascript-lint.js",
						"node_modules/codemirror/addon/tern/tern.js",
						"node_modules/codemirror/addon/runmode/colorize.js",
						"node_modules/codemirror/addon/runmode/runmode.js"
					],
					"codemirror.css": [
						"node_modules/codemirror/lib/codemirror.css",
						"node_modules/codemirror/theme/**/*.css",
						"node_modules/codemirror/addon/search/matchesonscrollbar.css",
						"node_modules/codemirror/addon/tern/tern.css",
						"node_modules/codemirror/addon/dialog/dialog.css",
						"node_modules/codemirror/addon/lint/lint.css",
						"node_modules/codemirror/addon/hint/show-hint.css"
					]
				}
			})
		]
	},
	merge(runtime[0], {
		output: {
			hashFunction: "sha256",
			filename: "nunu.min.js",
			path: output + "/files/runtime",
			library: "Nunu",
			libraryTarget: "umd"
		}
	})
];
