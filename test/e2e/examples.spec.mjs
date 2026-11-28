import fs from "node:fs";
import {test, expect, seedRandom} from "./fixtures.mjs";

/**
 * Every project in docs/examples is loaded with the runtime, run for a fixed amount of frames and checked for:
 *  - no errors while loading and running
 *  - the program survives a serialize -> parse round trip
 *  - the rendered frame matches the baseline screenshot
 *
 * Baselines are rendered with the runtime published on master (npm run test:baseline),
 * so a screenshot diff means the frame looks different from the previous release.
 */
const examples = fs.readdirSync("docs/examples").filter((f) => f.endsWith(".nsp")).map((f) => f.slice(0, -4)).sort();

// Per project exceptions, plain data:
//  skip: reason       not run at all
//  fails: reason      known issue, runs as an expected failure (Playwright reports it when it starts passing, remove the entry then)
//  self: reason       compared with a render of this branch (name.self.png) instead of the old runtime, not rendered with the old runtime
const randomEngine = "uses three.js random helpers or particles, which draw from the engine random stream, frames cannot match the old runtime";
const quirks = {
	camera: {self: randomEngine, fixedStep: true},
	// Repeated captures vary slightly as the physics objects and rain move.
	nunu: {fixedStep: true, maxDiffPixelRatio: 0.04},
	paint: {self: randomEngine},
	spine: {self: "the old runtime cannot load it (Spine 3.8 data with the 4.0 runtime, upgraded by SpineJson now)"}
};

const current = "/files/runtime/nunu.min.js";
const start = new Date("2024-01-01T00:00:00Z").getTime();

for (const name of examples)
{
	test(`example ${name}`, {tag: quirks[name]?.self !== undefined ? "@self" : []}, async ({page, runtime}) =>
	{
		const quirk = quirks[name] || {};
		test.skip(quirk.skip !== undefined, quirk.skip);
		test.skip(runtime !== current && quirk.self !== undefined, "not rendered with the old runtime");
		test.fail(runtime === current && quirk.fails !== undefined, quirk.fails);

		// Time is paused while the project loads (loading uses network and image events, not timers),
		// then exactly two seconds of animation frames are run, no time jump the engine could handle differently
		await seedRandom(page);
		await page.clock.install({time: start});
		await page.clock.pauseAt(start + 1000);
		await page.goto(`/harness/runtime.html?project=/examples/${name}.nsp&runtime=${runtime}`);
		await expect.poll(() => page.evaluate(() => window.loaded === true), {timeout: 45000, intervals: [100]}).toBe(true);
		const timer = quirk.fixedStep ? await page.evaluate(() =>
		{
			window.app.pause();
			return window.setInterval(() => window.app.update(), 16);
		}) : null;
		await page.clock.runFor(2000);

		// Render and read in one task, without preserveDrawingBuffer.
		const capture = () => page.evaluate((timer) =>
		{
			const app = window.app;
			if (timer === null)
			{
				app.pause();
				app.update();
			}
			else
			{
				// These scenes disable automatic clearing. Clear old depth and draw without another physics step.
				window.clearInterval(timer);
				app.renderer.clear();
				app.program.render(app.renderer);
			}
			return window.app.canvas.toDataURL("image/png").split(",")[1];
		}, timer);
		const liveFrame = timer !== null ? await capture() : null;

		if (runtime === current)
		{
			const counts = await page.evaluate(() =>
			{
				var count = (object) => { var n = 0; object.traverse(() => n++); return n; };
				var copy = new Nunu.ObjectLoader().parse(window.app.program.toJSON());
				return {original: count(window.app.program), copy: count(copy)};
			});
			expect(counts.copy, "objects after save/load round trip").toBe(counts.original);
		}

		const png = liveFrame ?? await capture();
		expect(Buffer.from(png, "base64")).toMatchSnapshot(quirk.self !== undefined ? `${name}.self.png` : `${name}.png`, quirk.maxDiffPixelRatio ? {maxDiffPixelRatio: quirk.maxDiffPixelRatio} : {});
	});
}
