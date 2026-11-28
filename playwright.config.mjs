import {defineConfig} from "@playwright/test";

const port = Number(process.env.NUNU_TEST_PORT || 8090);

export default defineConfig({
	testDir: "test/e2e",
	globalSetup: "./test/e2e/setup.mjs",
	outputDir: "test/.results",
	snapshotPathTemplate: "test/e2e/screenshots/{arg}{ext}",
	fullyParallel: true,
	// One retry on CI so a one-off flake is reported as flaky instead of failing the run
	retries: process.env.CI ? 1 : 0,
	timeout: 60000,
	reporter: process.env.CI ? [["github"], ["html", {outputFolder: "test/.report", open: "never"}]] : "list",
	use: {
		baseURL: `http://localhost:${port}`,
		viewport: {width: 1280, height: 720},
		// Software WebGL so renders are the same on every machine
		launchOptions: {args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]}
	},
	expect: {
		toMatchSnapshot: {maxDiffPixelRatio: 0.02}
	},
	projects: [
		// Code on this branch
		{name: "current", use: {runtime: "/files/runtime/nunu.min.js", strict: true}},
		// Runtime published on the reference branch, renders the example screenshots (npm run test:baseline)
		// Errors of the old runtime are reported as annotations instead of failing
		{name: "baseline", testMatch: /examples/, use: {runtime: "/cache/baseline/nunu.min.js", strict: false}}
	],
	webServer: {
		command: "npx webpack serve --config test/webpack.test.js",
		url: `http://localhost:${port}/files/runtime/nunu.min.js`,
		timeout: 180000,
		reuseExistingServer: !process.env.CI,
		stdout: "ignore"
	}
});
