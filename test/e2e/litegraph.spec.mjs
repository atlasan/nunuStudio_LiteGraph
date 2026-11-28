import {readFile} from "node:fs/promises";
import JSZip from "jszip";
import {test, expect} from "./fixtures.mjs";

const project = "/harness/legacy-litegraph.isp";

test("edits, plays, stops and reopens a legacy LiteGraphScript", async ({page}) =>
{
	await page.addInitScript(() =>
	{
		window.editorAlerts = [];
		window.alert = (message) => window.editorAlerts.push(message);
	});
	await page.goto("/");
	await page.waitForFunction(() => window.Editor?.program);
	await page.evaluate((url) => window.Editor.loadProgram(url, false), project);
	await page.evaluate(() =>
	{
		const {program, gui} = window.Editor;
		const script = program.getObjectByName("Legacy Motion");
		gui.tree.traverse((node) =>
		{
			if (node.object === script) node.element.dispatchEvent(new MouseEvent("dblclick", {bubbles: true}));
		});
	});

	await expect(page.locator(".litegraph canvas")).toBeVisible();
	const editing = await page.evaluate(() =>
	{
		const {program} = window.Editor;
		const script = program.getObjectByName("Legacy Motion");
		const target = program.getObjectByName("Replacement Target");
		const graph = script.graph;
		const canvas = graph.getCanvas();
		const objectNode = graph.getNodeById(1);
		window.Editor.selectObject(target);
		canvas.getNodeMenuOptions(objectNode).find((item) => item?.content === "Bind selected scene object").callback();
		graph.getNodeById(2).setProperty("x", 7);
		window.graphCanvasProbe = canvas;
		window.savedProject = JSON.stringify(program.toJSON());
		return {attached: canvas.graph === graph, nodes: graph._nodes.length, bound: objectNode.properties.nunu_uuid === target.uuid,
			positionBeforePlay: target.position.toArray()};
	});
	expect(editing).toEqual({attached: true, nodes: 3, bound: true, positionBeforePlay: [0, 0, 0]});

	await page.evaluate(() =>
	{
		window.Editor.loadProgram(new File([window.savedProject], "roundtrip.isp"), false);
	});
	await page.waitForFunction(() => window.graphCanvasProbe._disposed);
	expect(await page.evaluate(() => window.graphCanvasProbe.canvas)).toBeNull();

	await page.evaluate(() =>
	{
		const editor = window.Editor;
		const tabs = editor.gui.tab;
		const addTab = tabs.addTab;
		let runTab;
		tabs.addTab = function (...args)
		{
			runTab = addTab.apply(this, args);
			return runTab;
		};
		try
		{
			editor.runProject();
		}
		finally
		{
			tabs.addTab = addTab;
		}
		window.preview = runTab.program;
		window.previewGraph = window.preview.getObjectByName("Legacy Motion").graph;
	});
	await expect.poll(() => page.evaluate(() => window.preview.getObjectByName("Replacement Target").position.toArray())).toEqual([7, 2, 1]);
	const stopped = await page.evaluate(async () =>
	{
		const graph = window.previewGraph;
		window.Editor.runProject();
		const frame = graph._frame;
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		return {stopped: graph.status === graph.constructor.STATUS_STOPPED, frameUnchanged: graph._frame === frame,
			editorPosition: window.Editor.program.getObjectByName("Replacement Target").position.toArray()};
	});
	expect(stopped).toEqual({stopped: true, frameUnchanged: true, editorPosition: [0, 0, 0]});
	expect(await page.evaluate(() => window.editorAlerts)).toEqual(["Project loaded", "Project loaded"]);

	// Use the editor's web publisher and serve only the files it actually put in the ZIP.
	await page.evaluate(() => {window.prompt = () => "legacy-motion.zip";});
	const label = (name) => page.getByText(name, {exact: true}).filter({visible: true}).first();
	await label("File").hover();
	await label("Publish").hover();
	const web = await label("Web").boundingBox();
	const download = page.waitForEvent("download");
	await page.mouse.click(web.x + web.width / 2, web.y + web.height / 2);
	const archive = await JSZip.loadAsync(await readFile(await (await download).path()));
	const runtime = await archive.file("nunu.min.js").async("string");
	expect(runtime.includes("LiteGraphScript")).toBe(true);

	const published = await page.context().newPage();
	const publishedErrors = [];
	published.on("pageerror", (error) => publishedErrors.push(error.message));
	await published.route("**/published/**", async (route) =>
	{
		const filename = new URL(route.request().url()).pathname.split("/").at(-1);
		const entry = archive.file(filename);
		if (!entry)
		{
			await route.fulfill({status: 404});
			return;
		}

		const contentTypes = {html: "text/html", js: "text/javascript", png: "image/png"};
		await route.fulfill({
			body: await entry.async("nodebuffer"),
			contentType: contentTypes[filename.split(".").at(-1)] ?? "application/octet-stream"
		});
	});
	try
	{
		await published.goto("/published/index.html");
		await expect.poll(() => published.evaluate(() => window.app?.program?.getObjectByName("Replacement Target").position.toArray()))
			.toEqual([7, 2, 1]);
		expect(publishedErrors).toEqual([]);
	}
	finally
	{
		await published.close();
	}
});

test("the standalone runtime loads prototype graphs and still reopens Escher NodeScript", async ({page, runtime}) =>
{
	await page.goto(`/harness/runtime.html?project=${project}&runtime=${runtime}`);
	await page.waitForFunction(() => window.loaded === true);
	await expect.poll(() => page.evaluate(() => window.app.program.getObjectByName("Legacy Target").position.toArray())).toEqual([3, 2, 1]);
	const runtimeState = await page.evaluate(async () =>
	{
		const {app, Nunu} = window;
		const graph = app.program.getObjectByName("Legacy Motion").graph;
		const escher = new Nunu.ObjectLoader().parse(new Nunu.NodeScript().toJSON());
		const invalid = new Nunu.LiteGraphScript().toJSON();
		invalid.object.graph = null;
		let loadError;
		try
		{
			new Nunu.ObjectLoader().parse(invalid);
		}
		catch (error)
		{
			loadError = error.message;
		}
		app.pause();
		const frame = graph._frame;
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		const paused = graph._frame === frame;
		app.exit();
		return {paused, stopped: graph.status === graph.constructor.STATUS_STOPPED,
			timerUnset: graph.execution_timer_id == null, escher: escher.graph.type, loadError};
	});
	expect(runtimeState).toEqual({paused: true, stopped: true, timerUnset: true, escher: "NodeGraph",
		loadError: expect.stringContaining("Invalid LiteGraph script:")});
});
