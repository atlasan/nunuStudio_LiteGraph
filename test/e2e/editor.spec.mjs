import {test, expect, expectClean} from "./fixtures.mjs";

/**
 * Editor smoke test, written as a list of steps.
 *
 * Steps run in order on the same editor instance, after each one the page must have no errors.
 * To cover a new feature add a row: [name, async (page) => {...}].
 */
const editor = (page, fn, arg) => page.evaluate(fn, arg);
const visibleText = (page, label) => page.getByText(label, {exact: true}).filter({visible: true}).first();

// Click where a label is drawn, like a user would (nunuStudio labels ignore pointer events, their parent element handles them)
const clickText = async (page, label, clickCount = 1) =>
{
	const box = await visibleText(page, label).boundingBox();
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {clickCount: clickCount});
};

const menu = async (page, ...path) =>
{
	for (const label of path.slice(0, -1))
	{
		await visibleText(page, label).hover();
	}
	await clickText(page, path[path.length - 1]);
};

const steps = [
	["select an object", (page) => editor(page, () => window.Editor.selectObject(window.Editor.program.getObjectByName("box")))],

	...["1", "2", "3", "4", "5"].map((key) => [`tool shortcut ctrl+${key}`, async (page) =>
	{
		await page.keyboard.press(`Control+${key}`);
		await page.waitForTimeout(200);
	}]),

	["copy and paste", async (page) =>
	{
		await editor(page, () =>
		{
			var box = window.Editor.program.getObjectByName("box");
			window.Editor.selectObject(box);
			window.Editor.copyObject(box);
			window.Editor.pasteObject();
		});
		expect(await editor(page, () => window.Editor.selection[0].name)).toBe("box");
	}],

	["csg union of two objects", async (page) =>
	{
		await editor(page, () =>
		{
			var boxes = window.Editor.program.children[0].children.filter((o) => o.name === "box");
			boxes[1].position.set(0.5, 0.5, 0);
			window.Editor.selectObject(boxes[0]);
			window.Editor.addToSelection(boxes[1]);
		});
		await menu(page, "Edit", "CSG", "Union");
		expect(await editor(page, () => window.Editor.program.children[0].children.filter((o) => o.name === "box").length)).toBe(1);
	}],

	["undo and redo", (page) => editor(page, () => { window.Editor.undo(); window.Editor.redo(); })],

	["create an animation timeline", async (page) =>
	{
		const tracks = await editor(page, () =>
		{
			const {gui, program} = window.Editor;
			const animation = gui.animation;
			animation.attach(program.getObjectByName("box"));
			animation.add.element.click();
			const clip = animation.animations.at(-1);
			return {trackCount: clip.animation.tracks.length, timelineHeight: clip.timegrid.height};
		});
		expect(tracks).toEqual({trackCount: 4, timelineHeight: 121});
	}],

	["open material editor", (page) => clickText(page, "standard", 2)],

	["run and stop the program", async (page) =>
	{
		await clickText(page, "Run");
		await page.waitForTimeout(1500);
		await clickText(page, "Stop");
	}]
];

test("editor", async ({page}) =>
{
	await page.goto("/");
	await page.waitForFunction(() => window.Editor?.program?.getObjectByName("box") !== undefined, null, {timeout: 30000});
	expectClean(page);

	for (const [name, run] of steps)
	{
		await test.step(name, async () =>
		{
			await run(page);
			await page.waitForTimeout(100);
			expectClean(page);
		});
	}
});
