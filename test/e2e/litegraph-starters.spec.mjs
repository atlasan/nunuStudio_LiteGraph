import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {StaticPair} from "@as-com/pson";
import {test, expect} from "./fixtures.mjs";

const examples = new URL("../../source/files/examples/", import.meta.url);
const catalog = JSON.parse(readFileSync(new URL("visual-script-examples.json", examples))).examples;

function visibleText(page, text)
{
	return page.getByText(text, {exact: true}).filter({visible: true}).first();
}

async function clickText(page, text)
{
	const bounds = await visibleText(page, text).boundingBox();
	await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
}

function sample(page, read)
{
	return page.evaluate(read);
}

function poll(page, read)
{
	return expect.poll(() => sample(page, read));
}

async function aimAtBox(page)
{
	const point = await page.evaluate(() =>
	{
		const {program, canvas} = window.starterPreview;
		const camera = program.scene.cameras[0] || program.scene.defaultCamera;
		const actor = window.starterBox;
		const point = actor.getWorldPosition(actor.position.clone()).project(camera);
		const bounds = canvas.canvas.getBoundingClientRect();
		return {x: bounds.left + (1 + point.x) * bounds.width / 2,
			y: bounds.top + (1 - point.y) * bounds.height / 2, outside: bounds.left + 2};
	});
	return point;
}

const behaviors = {
	spin: async (page) =>
	{
		await poll(page, () => Math.abs(window.starterBox.rotation.y)).toBeGreaterThan(0.05);
	},
	move: async (page) =>
	{
		const position = () => window.starterBox.matrixWorld.elements[14];
		await page.evaluate(() =>
		{
			const {program} = window.starterPreview;
			const update = program.update;
			window.roverTransitions = [];
			program.update = function()
			{
				const z = window.starterBox.position.z;
				update.call(this);
				if (this.keyboard.keyJustPressed(83)) {window.roverTransitions.push(window.starterBox.position.z > z);}
				if (this.keyboard.keyJustReleased(83)) {window.roverTransitions.push(window.starterBox.position.z === z);}
			};
		});
		const start = await sample(page, position);
		const tapBetweenFrames = (code) => page.evaluate((code) =>
		{
			const {canvas} = window.starterPreview.canvas;
			for (const type of ["keydown", "keyup"])
			{
				canvas.dispatchEvent(new KeyboardEvent(type, {code, bubbles: true}));
			}
		}, code);
		await tapBetweenFrames("KeyW");
		await poll(page, position).toBeLessThan(start - 0.4);
		await tapBetweenFrames("KeyS");
		await poll(page, position).toBe(start);
		await tapBetweenFrames("KeyS");
		await poll(page, position).toBeGreaterThan(start + 0.4);
		await tapBetweenFrames("KeyR");
		await poll(page, position).toBe(start);
		await page.evaluate(() => {window.roverTransitions.length = 0;});
		await page.keyboard.down("w");
		await poll(page, position).toBeLessThan(start - 0.05);
		await page.keyboard.up("w");
		await poll(page, () => window.starterPreview.program.keyboard.keyPressed(87)).toBe(false);
		const forward = await sample(page, position);
		await page.keyboard.down("s");
		await poll(page, position).toBeGreaterThan(forward + 0.05);
		await page.keyboard.up("s");
		await poll(page, () => window.roverTransitions).toEqual([true, true]);
		await page.keyboard.down("s");
		await poll(page, () => window.starterPreview.program.keyboard.keyPressed(83)).toBe(true);
		await page.evaluate(() => window.dispatchEvent(new Event("blur")));
		await poll(page, () => window.starterPreview.program.keyboard.keyPressed(83)).toBe(false);
		await page.keyboard.up("s");
		await page.keyboard.press("r");
		await poll(page, position).toBe(start);
	},
	visibility: async (page) =>
	{
		expect(await sample(page, () => window.starterBox.visible)).toBe(true);
		await page.evaluate(() =>
		{
			const canvas = window.starterPreview.canvas.canvas;
			for (const type of ["keydown", "keyup"])
			{
				canvas.dispatchEvent(new KeyboardEvent(type, {code: "Space", bubbles: true}));
			}
		});
		await poll(page, () => window.starterBox.visible).toBe(false);
		await page.keyboard.press("Space");
		await poll(page, () => window.starterBox.visible).toBe(true);
	},
	tint: async (page) =>
	{
		await poll(page, () => window.starterBox.material.color.getHexString()).toBe("55dd88");
		expect(await sample(page, () => window.starterPreview.program.getObjectByName("Reference sample").material.color.getHexString())).toBe("66bbff");
	},
	camera: async (page) =>
	{
		await poll(page, () => window.starterPreview.program.getObjectByName("Camera").fov).toBe(35);
	},
	spawn: async (page) =>
	{
		await poll(page, () => window.starterScript.getObjectByName("Runtime spawns")?.children.length).toBe(1);
	},
	"spawn-delete": async (page) =>
	{
		const count = () => window.starterScript.getObjectByName("Runtime spawns")?.children.length ?? 0;
		expect(await sample(page, count)).toBe(0);
		await page.keyboard.press("Space", {delay: 100});
		await poll(page, count).toBe(1);
		await page.keyboard.press("d", {delay: 100});
		await poll(page, count).toBe(0);
	},
	light: async (page) =>
	{
		await poll(page, () => window.starterPreview.program.getObjectByName("Key light").intensity).toBe(2);
	},
	"hover-highlight": async (page) =>
	{
		const point = await aimAtBox(page);
		await page.mouse.move(point.outside, point.y);
		await page.mouse.move(point.x, point.y);
		await poll(page, () => window.starterBox.material.color.getHexString()).toBe("ffcc44");
		await page.mouse.move(point.outside, point.y);
		await poll(page, () => window.starterBox.material.color.getHexString()).toBe("66bbff");
	},
	"click-copy": async (page) =>
	{
		const point = await aimAtBox(page);
		await page.mouse.move(point.x, point.y);
		await page.mouse.down();
		await poll(page, () => window.starterScript.getObjectByName("Runtime spawns")?.children.length).toBe(1);
		await page.mouse.up();
	},
	jump: async (page) =>
	{
		await poll(page, () => window.starterScript.graph.findNodesByType("nunu/physics/collision")[0].getOutputData(0)).toBe(true);
		await page.keyboard.down("Space");
		await poll(page, () => window.starterPreview.program.getObjectByName("Physics box").body.velocity.y).toBeGreaterThan(1);
		await page.keyboard.up("Space");
	},
	sound: async (page) =>
	{
		await page.keyboard.down("Space");
		await poll(page, () => window.starterScript.graph.findNodesByType("nunu/audio/playback")[0].getOutputData(2)).toBe(true);
		await poll(page, () => window.starterPreview.program.getObjectByName("Synth activity light").visible).toBe(true);
		await page.keyboard.up("Space");
		await poll(page, () => window.starterPreview.program.getObjectByName("Synth activity light").visible).toBe(false);
	},
	animation: async (page) =>
	{
		await poll(page, () => window.starterBox.mixer.playing).toBe(true);
		await page.keyboard.press("Space", {delay: 100});
		await poll(page, () => window.starterBox.mixer.playing).toBe(false);
	},
	"input-monitor": async (page) =>
	{
		const picker = page.getByLabel("Running graph");
		await expect(picker).toHaveCount(0);
		await clickText(page, "Graph Debug");
		await expect(picker.locator("option")).toHaveText(["Listener A", "Listener B"]);
		await page.evaluate(() =>
		{
			const scene = window.starterPreview.program.scene;
			const nested = scene.getObjectByName("Listener B").graph.findNodesByType("graph/subgraph")[0];
			const tick = nested.onExecute;
			nested.onExecute = function() {tick.call(this); tick.call(this);};
			window.inputObservers = [scene.getObjectByName("Listener A").graph,
				scene.getObjectByName("Listener B").graph, nested.subgraph];
		});
		const count = (title, listeners = 3) => page.evaluate(({title, listeners}) =>
			window.inputObservers.slice(0, listeners).map((graph) =>
				graph.findNodesByType("events/counter").find((node) => node.title === title).num),
		{title, listeners});
		const preview = page.locator('canvas[aria-label="Run"]:visible');
		const monitor = page.locator('canvas[aria-label="Live Graph"]:visible');
		const bounds = await preview.boundingBox();

		await expect(preview).toBeFocused();
		await page.keyboard.press("r");
		await expect.poll(() => count("Key up")).toEqual([1, 1, 1]);
		const graphBounds = await monitor.boundingBox();
		await page.mouse.click(graphBounds.x + 10, graphBounds.y + 10);
		await expect(preview).toBeFocused();
		await picker.selectOption({label: "Listener B"});
		await picker.focus();
		await page.keyboard.press("w");
		expect(await count("Key down")).toEqual([1, 1, 1]);
		await page.getByRole("button", {name: "Focus preview"}).click();
		await expect(preview).toBeFocused();
		await page.keyboard.down("w");
		await expect.poll(() => count("Key down")).toEqual([2, 2, 2]);
		const held = () => ["Keyboard status", "Mirror keyboard"].map((name) =>
			window.starterPreview.program.getObjectByName(name).text);
		await poll(page, held).toEqual(["Keys held: W  ·  W pressed", "Keys held: W  ·  W pressed"]);
		await page.keyboard.up("w");
		await expect.poll(() => count("Key up")).toEqual([2, 2, 2]);
		await expect.poll(() => monitor.evaluate((canvas) =>
		{
			const {data} = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
			for (let i = 0; i < data.length; i += 4)
			{
				if (data[i] === 117 && data[i + 1] === 248 && data[i + 2] === 198) {return true;}
			}
			return false;
		}), {timeout: 1600, intervals: [20, 40, 80]}).toBe(true);

		await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
		await expect.poll(async () => (await count("Pointer moves", 1))[0]).toBeGreaterThan(0);
		await preview.evaluate((canvas) =>
		{
			const bounds = canvas.getBoundingClientRect();
			for (const type of ["mousedown", "mouseup"])
			{
				canvas.dispatchEvent(new MouseEvent(type, {
					button: 0, bubbles: true, clientX: bounds.left + 20, clientY: bounds.top + 20
				}));
			}
		});
		await expect.poll(() => count("Button down")).toEqual([1, 1, 1]);
		await expect.poll(() => count("Button up")).toEqual([1, 1, 1]);
		await page.mouse.wheel(0, 110);
		await poll(page, () => window.starterPreview.program.getObjectByName("Pointer status").text).toContain("Last scroll: 110");
		await picker.selectOption({label: "Listener A"});

		await page.evaluate(() => window.Editor.selectObject(window.Editor.program.getObjectByName("Title")));
		await preview.focus();
		await page.keyboard.press("Delete");
		await expect.poll(() => count("Key down")).toEqual([3, 3, 3]);
		expect(await sample(page, () => window.Editor.program.getObjectByName("Title").type)).toBe("TextSprite");
	}
};

for (const {id, title, binary, json, nodes} of catalog)
{
	test(`starter ${id} opens from Examples and runs`, async ({page}) =>
	{
		const original = JSON.parse(readFileSync(new URL(json, examples)));
		assert.deepEqual(new StaticPair().decode(readFileSync(new URL(binary, examples))), original);

		await page.addInitScript(() =>
		{
			window.confirm = () => true;
			window.projectMessages = [];
			window.alert = (message) => window.projectMessages.push(message);
		});
		if (id === "click-copy")
		{
			await page.addInitScript(() => {Object.defineProperty(window, "devicePixelRatio", {value: 2});});
		}
		await page.goto("/");
		await page.waitForFunction(() => window.Editor?.program);
		if (id === "click-copy")
		{
			await page.evaluate(() => {window.Editor.settings.general.ignorePixelRatio = false;});
		}
		const request = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/files/examples/" + binary));
		for (const label of ["File", "Examples", "LiteGraph Starters"])
		{
			await visibleText(page, label).hover();
		}
		await clickText(page, title);
		expect((await request).ok()).toBe(true);
		await poll(page, () => window.projectMessages).toEqual(["Project loaded"]);
		expect(await sample(page, () => window.Editor.openFile)).toBeNull();
		expect(await sample(page, () => window.Editor.program.children[0].children
			.find((object) => object.type === "LiteGraphScript").graph.getMissingNodes())).toEqual([]);

		await clickText(page, "Run");
		const loaded = await page.evaluate(() =>
		{
			const editor = window.Editor;
			const tabs = editor.gui.tab.getActiveTab();
			window.starterPreview = tabs.find((tab) => tab.program && tab.program !== editor.program);
			const program = window.starterPreview.program;
			window.starterScript = program.scene.children.find((object) => object.type === "LiteGraphScript");
			window.starterBox = program.scene.children.find((object) => object.isMesh);
			return window.starterScript.graph._nodes.map((node) => node.type);
		});
		expect(loaded).toEqual(nodes);
		await poll(page, () => window.starterScript.graph._frame).toBeGreaterThan(0);
		expect(await sample(page, () => document.activeElement === window.starterPreview.canvas.canvas)).toBe(true);
		expect(await sample(page, () => window.starterPreview.program.getObjectByName("Title").text)).toBe(title);
		expect(await sample(page, () => window.starterPreview.program.getObjectByName("Controls")?.text)).toBeTruthy();
		if (id === "click-copy")
		{
			const scale = await sample(page, () =>
			{
				const {canvas} = window.starterPreview.canvas;
				return canvas.width / canvas.getBoundingClientRect().width;
			});
			expect(scale).toBeCloseTo(2, 1);
		}
		await behaviors[id](page);
		expect(await sample(page, () => window.starterScript.graph.errors_in_execution)).toBe(false);

		await clickText(page, "Stop");
		expect(await sample(page, () => ({
			running: window.starterScript.graph.status === window.starterScript.graph.constructor.STATUS_RUNNING,
			spawns: window.starterScript.getObjectByName("Runtime spawns") !== undefined
		}))).toEqual({running: false, spawns: false});
		if (id === "input-monitor")
		{
			await expect(page.getByLabel("Running graph")).toBeDisabled();
		}
		if (id === "move")
		{
			await page.evaluate(() => {window.Editor.settings.general.immediateMode = true;});
			for (let run = 0; run < 2; run++)
			{
				await clickText(page, "Run");
				const position = () => window.Editor.program.getObjectByName("Rover").position.z;
				const start = await sample(page, position);
				await page.keyboard.down("w");
				await poll(page, position).toBeLessThan(start - 0.05);
				await page.keyboard.up("w");
				await clickText(page, "Stop");
			}
		}
	});
}
