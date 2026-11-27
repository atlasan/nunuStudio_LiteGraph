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
//  random: reason     frames depend on the engine random stream, compared with a render of this branch (name.self.png) instead of the old runtime
//  baseline: false    not rendered with the old runtime
const randomEngine = "uses three.js random helpers or particles, which draw from the engine random stream, frames cannot match the old runtime";
const quirks = {
	camera: {random: randomEngine, baseline: false},
	paint: {random: randomEngine, baseline: false},
	flappy: {fails: "the \"text\" label is not rendered (regression), pipe heights also come from the engine random stream"},
	nunu: {fails: "rock and log meshes use the legacy Geometry JSON format and load as empty geometry, lens flare is missing (regressions)"},
	pbr: {fails: "scene background and environment map render black (regression)"},
	rollercoaster: {fails: "the example script extends a three.js class with BufferGeometry.call(this), it needs updating to ES6 classes"},
	spine: {fails: "the Spine object does not load (atlas textures), already broken with the old runtime", baseline: false}
};

const current = "/nunu.min.js";
const start = new Date("2024-01-01T00:00:00Z").getTime();

for (const name of examples)
{
	test(`example ${name}`, {tag: quirks[name]?.random !== undefined ? "@self" : []}, async ({page, runtime}) =>
	{
		const quirk = quirks[name] || {};
		test.skip(quirk.skip !== undefined, quirk.skip);
		test.skip(runtime !== current && (quirk.baseline === false || quirk.random !== undefined), "not rendered with the old runtime");
		test.fail(runtime === current && quirk.fails !== undefined, quirk.fails);

		await seedRandom(page);
		await page.clock.install({time: start});
		await page.goto(`/harness/runtime.html?project=/examples/${name}.nsp&runtime=${runtime}`);
		await page.waitForFunction(() => window.loaded === true, null, {timeout: 45000});

		// Deterministic frames: freeze time, then advance two seconds of animation frames
		await page.clock.pauseAt(start + 60000);
		await page.clock.runFor(2000);

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

		// Render one more frame and read it in the same task (no preserveDrawingBuffer needed, no timing involved)
		const png = await page.evaluate(() =>
		{
			window.app.pause();
			window.app.update();
			return window.app.canvas.toDataURL("image/png").split(",")[1];
		});
		expect(Buffer.from(png, "base64")).toMatchSnapshot(quirk.random !== undefined ? `${name}.self.png` : `${name}.png`, quirk.maxDiffPixelRatio ? {maxDiffPixelRatio: quirk.maxDiffPixelRatio} : {});
	});
}
