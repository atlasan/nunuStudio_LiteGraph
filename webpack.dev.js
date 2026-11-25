const Webpack = require("webpack");
const {GitRevisionPlugin} = require("git-revision-webpack-plugin");
const {merge} = require("webpack-merge");

const git = new GitRevisionPlugin();

const common = require("./webpack.config.js");

module.exports = [
	merge(common[0], {
		mode: "development",
		optimization: {minimize: false},
		devtool: 'inline-source-map',
		performance: {
			hints: false,
		},
		// Keep inotify usage small. When the system watch limit is reached anyway,
		// watchpack falls back to polling instead of failing (or set WATCHPACK_POLLING=true).
		watchOptions: {
			ignored: ["**/node_modules/**", "**/.git/**", "**/docs/**"]
		},
		devServer: {
			// docs/editor is this build's own output, served from memory while developing.
			// Watching it on disk adds nothing and crashes the server with ENOSPC when
			// the inotify limit is exhausted by other applications.
			static: {
				directory: common[0].output.path,
				watch: false
			},
			compress: false,
			historyApiFallback: true,
			hot: true
		},
		plugins: [
			new Webpack.DefinePlugin({
				"VERSION": JSON.stringify(require("./package.json").version),
				"TIMESTAMP": JSON.stringify(new Date().toISOString()),
				"REPOSITORY_BRANCH": JSON.stringify(git.branch()),
				"REPOSITORY_COMMIT": JSON.stringify(git.commithash()),
				"DEVELOPMENT": JSON.stringify(true)
			})
		]
	}),
	common[1]
];
