const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const THREE = require("three");
const root = path.resolve(__dirname, "..");

// Load the actual ESM integration and library without changing the legacy
// CommonJS package contract. Stub unrelated engine resource loaders only.
const actual = new Set([
	"source/lib/litegraph.js",
	"source/core/objects/script/LiteGraphRuntime.js",
	"source/core/objects/script/LiteGraphSpawnContext.js",
	"source/core/objects/script/litegraph_nodes/LiteGraphLifecycleNodes.js",
	"source/core/objects/script/LiteGraphContext.js",
	"source/core/objects/script/LiteGraphNodeCatalog.js",
	"source/core/objects/script/litegraph_nodes/LiteGraphObjectNodes.js",
	"source/core/objects/script/LiteGraphStarter.js",
	"source/core/objects/script/litegraph_nodes/LiteGraphEngineNodes.js",
	"source/editor/gui/tab/litegraph/GraphHistory.js",
	"source/core/objects/script/LiteGraphScript.js",
	"source/core/objects/script/litegraph_nodes/LiteGraphNunuNodes.js",
	"source/core/utils/ObjectUtils.js",
	"source/core/loaders/ObjectLoader.js"
]);
THREE.Object3D.prototype.initialize = function() {};
THREE.Object3D.prototype.update = function() {};
THREE.Object3D.prototype.dispose = function() {};
THREE.Object3D.prototype.getScene = function()
{
	for (let node = this.parent; node; node = node.parent)
	{
		if (node.isScene) return node;
	}
	return null;
};
const context = vm.createContext({console, performance, setTimeout, clearTimeout, setInterval, clearInterval, URL, Blob, Buffer, fetch, queueMicrotask, structuredClone, TextEncoder, TextDecoder});
const modules = new Map();
function synthetic(key, values)
{
	if (!modules.has(key)) modules.set(key, new vm.SyntheticModule(Object.keys(values), function()
	{
		for (const [name, value] of Object.entries(values)) this.setExport(name, value);
	}, {context, identifier: key}));
	return modules.get(key);
}
function load(relative)
{
	if (!modules.has(relative)) modules.set(relative, new vm.SourceTextModule(fs.readFileSync(path.join(root, relative), "utf8"), {context, identifier: relative, importModuleDynamically: (specifier) => import(specifier)}));
	return modules.get(relative);
}
async function linker(specifier, parent)
{
	if (specifier === "three") return synthetic("three", THREE);
	const relative = path.posix.normalize(path.posix.join(path.posix.dirname(parent.identifier), specifier));
	if (actual.has(relative)) return load(relative);
	if (relative.endsWith("/Group.js")) return synthetic(relative, {Group: THREE.Group});
	const source = fs.readFileSync(path.join(root, parent.identifier), "utf8");
	const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const clause = source.match(new RegExp('import\\s*\\{([^}]+)\\}\\s*from\\s*["\\\']' + escaped + '["\\\']'));
	assert.ok(clause, "Unexpected dependency " + specifier);
	const values = {};
	for (const name of clause[1].split(",").map((name) => name.trim())) values[name] = function() {};
	return synthetic(relative, values);
}
const entry = new vm.SourceTextModule(`
export {LiteGraph,LGraph,LGraphCanvas} from './source/lib/litegraph.js';
export {LiteGraphRuntime} from './source/core/objects/script/LiteGraphRuntime.js';
export {LiteGraphScript} from './source/core/objects/script/LiteGraphScript.js';
export {addRotationStarter,getNunuExampleCatalog,acceptsExample,addVisualScriptExample} from './source/core/objects/script/LiteGraphStarter.js';
export {getNunuNodeCatalog} from './source/core/objects/script/LiteGraphNodeCatalog.js';
export {seedGraphHistory} from './source/editor/gui/tab/litegraph/GraphHistory.js';
export {ObjectUtils} from './source/core/utils/ObjectUtils.js';
export {ObjectLoader} from './source/core/loaders/ObjectLoader.js';
`, {context, identifier: "entry.js"});
const ready = entry.link(linker).then(() => entry.evaluate()).then(() => entry.namespace);

function savedGraph(graph)
{
	// The browser parses saved JSON in the same realm as the library. Preserve
	// that contract here: LiteGraph's legacy link decoder checks Array identity.
	context.savedGraphJSON = JSON.stringify(graph.serialize());
	try { return vm.runInContext("JSON.parse(savedGraphJSON)", context); }
	finally { delete context.savedGraphJSON; }
}

function node(graph, type)
{
	const result = entry.namespace.LiteGraph.createNode(type);
	assert.ok(result, type + " is registered");
	graph.add(result);
	return result;
}
function probe(LiteGraph, type, hooks)
{
	function Probe() {}
	Object.assign(Probe.prototype, hooks);
	LiteGraph.registerNodeType(type, Probe);
}

test("engine owns start, frame delta, nested time and stop without timers", async () =>
{
	const {LiteGraph, LiteGraphScript, LGraph} = await ready;
	const calls = [];
	probe(LiteGraph, "test/lifecycle", {
		onStart() { calls.push("start"); },
		onExecute() { calls.push([this.graph.elapsed_time, this.graph.globaltime]); },
		onStop() { calls.push("stop"); }
	});
	const script = new LiteGraphScript();
	node(script.graph, "test/lifecycle");
	const sub = node(script.graph, "graph/subgraph");
	node(sub.subgraph, "test/lifecycle");
	const clock = LiteGraph.getTime;
	await script.initialize();
	assert.equal(script.graph.status, LGraph.STATUS_RUNNING);
	assert.equal(script.graph.execution_timer_id, undefined);
	script.update(0.25);
	assert.equal(LiteGraph.getTime, clock);
	assert.equal(script.graph.fixedtime, 0.25);
	assert.equal(script.graph.globaltime, 0.25);
	assert.equal(sub.subgraph.globaltime, 0.25);
	assert.equal(sub.subgraph.elapsed_time, 0.25);
	assert.ok(calls.filter(Array.isArray).every(([delta, time]) => delta === 0.25 && time === 0.25));
	script.dispose();
	script.dispose();
	assert.equal(calls.filter((call) => call === "start").length, 2);
	assert.equal(calls.filter((call) => call === "stop").length, 2);
	const count = calls.length;
	script.update(1);
	assert.equal(calls.length, count);
	await script.initialize();
	assert.equal(script.graph.engineTime, 0);
	assert.equal(sub.subgraph.fixedtime, 0);
	script.dispose();
});

test("disposing while readiness is pending cancels startup", async () =>
{
	const {LiteGraph, LiteGraphScript, LGraph} = await ready;
	let release;
	let starts = 0;
	probe(LiteGraph, "test/pending", {onStart() { starts++; }});
	const script = new LiteGraphScript();
	const waiting = node(script.graph, "test/pending");
	waiting.ready = new Promise((resolve) => { release = resolve; });
	const startup = script.initialize();
	script.dispose();
	release();
	assert.equal(await startup, false);
	assert.equal(starts, 0);
	assert.equal(script.graph.status, LGraph.STATUS_STOPPED);
});

test("engine clock restores after execution errors", async () =>
{
	const {LiteGraph, LiteGraphScript, LGraph} = await ready;
	probe(LiteGraph, "test/error", {onExecute() { throw new Error("probe failure"); }});
	const script = new LiteGraphScript();
	node(script.graph, "test/error");
	await script.initialize();
	const clock = LiteGraph.getTime;
	const previous = LiteGraph.throw_errors;
	LiteGraph.throw_errors = true;
	try { assert.throws(() => script.update(0.1), /probe failure/); }
	finally { LiteGraph.throw_errors = previous; }
	assert.equal(LiteGraph.getTime, clock);
	assert.equal(script.graph.status, LGraph.STATUS_STOPPED);
});

test("detached scripts round-trip and resolve live scene targets including deletion", async () =>
{
	const {LiteGraphScript} = await ready;
	const script = new LiteGraphScript();
	const reference = node(script.graph, "nunu/object");
	const target = new THREE.Group();
	reference.setProperty("nunu_uuid", target.uuid);
	const restored = new LiteGraphScript(savedGraph(script.graph));
	const restoredReference = restored.graph._nodes[0];
	restoredReference.onExecute();
	assert.equal(restoredReference.getOutputData(0), null);
	const scene = new THREE.Scene();
	scene.add(target, restored);
	restoredReference.onExecute();
	assert.equal(restoredReference.getOutputData(0), target);
	scene.remove(target);
	restoredReference.onExecute();
	assert.equal(restoredReference.getOutputData(0), null);
});

test("paste remaps sibling and nested references while preserving external UUIDs", async () =>
{
	const {LiteGraphScript, ObjectUtils} = await ready;
	const target = new THREE.Group();
	const script = new LiteGraphScript();
	const reference = node(script.graph, "nunu/object");
	reference.setProperty("nunu_uuid", target.uuid);
	const sub = node(script.graph, "graph/subgraph");
	const nested = node(sub.subgraph, "nunu/object");
	nested.setProperty("nunu_uuid", target.uuid);
	const external = node(script.graph, "nunu/object");
	external.setProperty("nunu_uuid", "outside-selection");
	const old = target.uuid;
	const mapping = ObjectUtils.regenerateUUIDs([script, target]);
	assert.notEqual(target.uuid, old);
	assert.equal(mapping.get(old), target.uuid);
	assert.equal(reference.properties.nunu_uuid, target.uuid);
	assert.equal(nested.properties.nunu_uuid, target.uuid);
	assert.equal(external.properties.nunu_uuid, "outside-selection");
	const scene = new THREE.Scene();
	scene.add(script, target);
	nested.onExecute();
	assert.equal(nested.getOutputData(0), target);
});

test("loader configures before callback, handles images and repeated parses", async () =>
{
	const {ObjectLoader, LiteGraphScript} = await ready;
	const script = new LiteGraphScript();
	node(script.graph, "basic/const");
	const loader = new ObjectLoader();
	// These resource implementations are unrelated to graph/tree loading.
	for (const method of ["parseResources", "parseShape", "parseImages", "parseGeometries", "parseVideos", "parseAudio", "parseFonts", "parseTextures", "parseMaterials"]) loader[method] = function() {};
	let callbacks = 0;
	const data = {object: {type: "LiteGraphScript", uuid: script.uuid, name: script.name, graph: script.graph.serialize()}, images: [{uuid: "image"}]};
	const first = loader.parse(data, (loaded) =>
	{
		callbacks++;
		assert.ok(loaded instanceof LiteGraphScript);
		assert.equal(loaded.graph._nodes.length, 1);
	});
	const second = loader.parse(data, () => { callbacks++; });
	assert.notEqual(first.graph, second.graph);
	assert.equal(callbacks, 2);
	assert.equal(loader.postActions, undefined);
});

test("node selection uses editor injection and position node updates real objects", async () =>
{
	const {LiteGraphScript} = await ready;
	const script = new LiteGraphScript();
	const object = new THREE.Group();
	const reference = node(script.graph, "nunu/object");
	new THREE.Scene().add(script, object);
	script.graph.nunuSelection = () => object;
	reference.widgets[0].callback();
	assert.equal(reference.properties.nunu_uuid, object.uuid);
	const position = node(script.graph, "nunu/position_set");
	position.getInputData = (slot) => slot === 0 ? object : [1, 2, 3];
	position.onExecute();
	assert.deepEqual(object.position.toArray(), [1, 2, 3]);
});

test("graph tab rebind and close dispose actual canvases and detach graphs", async () =>
{
	const {LiteGraphScript, LGraphCanvas} = await ready;
	function TabComponent() {}
	TabComponent.prototype.destroy = function() { this.baseDestroyed = true; };
	TabComponent.prototype.setName = function(name) { this.title = name; };
	const source = fs.readFileSync(path.join(root, "source/editor/gui/tab/litegraph/LitegraphEditor.js"), "utf8");
	const module = new vm.SourceTextModule(source, {context, identifier: "editor-test.js"});
	await module.link((specifier) =>
	{
		if (specifier.endsWith("/litegraph.js")) return load("source/lib/litegraph.js");
		if (specifier.endsWith("/LiteGraphNodeCatalog.js")) return load("source/core/objects/script/LiteGraphNodeCatalog.js");
		if (specifier.endsWith("/LiteGraphContext.js")) return load("source/core/objects/script/LiteGraphContext.js");
		if (specifier.endsWith("/LiteGraphStarter.js")) return load("source/core/objects/script/LiteGraphStarter.js");
		if (specifier.endsWith("/GraphHistory.js")) return load("source/editor/gui/tab/litegraph/GraphHistory.js");
		if (specifier.endsWith("/Component.js")) return synthetic("test/component", {Component: function() {}});
		if (specifier.endsWith("/Canvas.js")) return synthetic("test/canvas", {Canvas: function() {}});
		if (specifier.endsWith("/Global.js")) return synthetic("test/global", {Global: {FILE_PATH: ""}});
		if (specifier.endsWith("/LocaleManager.js")) return synthetic("test/locale", {Locale: {litegraphGraph: "LiteGraph"}});
		if (specifier.endsWith("/TabComponent.js")) return synthetic("test/tab", {TabComponent});
		if (specifier.endsWith("/Editor.js")) return synthetic("test/editor", {Editor: {selection: [], getPixelRatio: () => 2}});
		throw new Error(specifier);
	});
	await module.evaluate();
	const editor = Object.create(module.namespace.LitegraphEditor.prototype);
	editor.node = null;
	editor.graphcanvas = null;
	editor.canvas = {element: null}; // no DOM/rendering needed to check ownership
	editor.selectionProvider = () => null;
	editor.resizeGraph = function() {};
	const first = new LiteGraphScript();
	const second = new LiteGraphScript();
	editor.attach(first);
	const canvas = editor.graphcanvas;
	assert.ok(canvas instanceof LGraphCanvas);
	assert.equal(canvas.is_rendering, undefined);
	assert.equal(canvas.options.hide_widget_label_when_small, 0);
	assert.equal(first.graph.list_of_graphcanvas.length, 1);
	editor.attach(second);
	assert.equal(canvas._disposed, true);
	assert.equal(first.graph.list_of_graphcanvas.length, 0);
	assert.equal(first.graph.nunuSelection, undefined);
	const secondCanvas = editor.graphcanvas;
	editor.active = true;
	editor.destroy();
	editor.destroy();
	assert.equal(secondCanvas._disposed, true);
	assert.equal(second.graph.list_of_graphcanvas.length, 0);
	assert.equal(second.graph.nunuSelection, undefined);
	assert.equal(editor.active, false);
	assert.equal(editor.baseDestroyed, true);
});

test("restart waits for asynchronous node cleanup", async () =>
{
	const {LiteGraph, LiteGraphScript} = await ready;
	let release;
	let starts = 0;
	probe(LiteGraph, "test/cleanup", {
		onStart() { starts++; },
		onStop() { return new Promise((resolve) => { release = resolve; }); }
	});
	const script = new LiteGraphScript();
	node(script.graph, "test/cleanup");
	await script.initialize();
	script.dispose();
	const restart = script.initialize();
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(starts, 1);
	release();
	assert.equal(await restart, true);
	assert.equal(starts, 2);
	script.dispose();
	release();
	await script.graph.whenIdle();
});

test("readiness failure is reported and prevents execution", async () =>
{
	const {LiteGraphScript, LGraph} = await ready;
	const script = new LiteGraphScript();
	const failing = node(script.graph, "basic/const");
	failing.initialization_error = new Error("dependency failed");
	await assert.rejects(script.initialize(), /dependency failed/);
	assert.equal(script.graph.status, LGraph.STATUS_STOPPED);
	assert.equal(script.graph.initialization_error.message, "dependency failed");
	script.update(1);
	assert.equal(script.graph.iteration, 0);
});

test("saved graph drives a live scene object's position through connected nodes", async () =>
{
	const {LiteGraphScript} = await ready;
	const target = new THREE.Group();
	const scene = new THREE.Scene();
	const source = new LiteGraphScript();
	const reference = node(source.graph, "nunu/object");
	reference.setProperty("nunu_uuid", target.uuid);
	const vector = node(source.graph, "math3d/xyz-to-vec3");
	Object.assign(vector.properties, {x: 4, y: 5, z: 6});
	const setter = node(source.graph, "nunu/position_set");
	assert.ok(reference.connect(0, setter, 0));
	assert.ok(vector.connect(0, setter, 1));
	const script = new LiteGraphScript(savedGraph(source.graph));
	scene.add(target, script);
	await script.initialize();
	script.update(0.1);
	assert.deepEqual(target.position.toArray(), [4, 5, 6]);
	script.dispose();
});

test("starter survives project-object loading and rotates only the cloned target", async () =>
{
	const {LiteGraphScript, addRotationStarter, ObjectLoader} = await ready;
	const target = new THREE.Group();
	target.name = "box";
	target.matrixAutoUpdate = false;
	const script = new LiteGraphScript();
	addRotationStarter(script.graph, target.uuid);
	const serialized = {object: {type:"Group", uuid:"copied-root", name:"selection", visible:true, children:[
		{type:"Group",uuid:target.uuid,name:"box",visible:true,matrixAutoUpdate:false},
		{type:"LiteGraphScript",uuid:script.uuid,name:script.name,visible:true,graphVersion:1,graph:savedGraph(script.graph)}
	]}};
	const loader = new ObjectLoader();
	for (const method of ["parseResources", "parseShape", "parseImages", "parseGeometries", "parseVideos", "parseAudio", "parseFonts", "parseTextures", "parseMaterials"]) loader[method] = function() {};
	const copy = loader.parse(serialized);
	new THREE.Scene().add(copy);
	const clonedScript = copy.children[1];
	assert.equal(clonedScript.graphVersion, 1);
	await clonedScript.initialize();
	for (let i = 0; i < 60; i++) clonedScript.update(1 / 60);
	assert.ok(Math.abs(copy.children[0].rotation.y - 1) < 1e-6);
	assert.notEqual(copy.children[0].matrix.elements[0], 1);
	assert.equal(target.rotation.y, 0);
	clonedScript.dispose();
});

test("scene lifecycle delivers initial resize and app data after readiness", async () =>
{
	const {LiteGraph, LiteGraphScript} = await ready;
	const received = [];
	probe(LiteGraph, "test/lifecycle-events", {onAction(action, data) { received.push({action,data}); }});
	const script = new LiteGraphScript();
	const events = node(script.graph, "nunu/events");
	const recorder = node(script.graph, "test/lifecycle-events");
	recorder.mode = LiteGraph.ON_EVENT;
	for (const name of ["start","update","stop","resize","data"]) recorder.addInput(name, LiteGraph.ACTION);
	for (let i = 0; i < 5; i++) events.connect(i, recorder, i);
	const startup = script.initialize();
	script.resize(640,480);
	script.appData({hello:"scene"});
	await startup;
	script.update(0.5);
	assert.equal(events.getOutputData(5), 0.5);
	assert.equal(events.getOutputData(6), 0.5);
	script.dispose();
	assert.deepEqual(received.map((event) => event.action), ["start","resize","data","update","stop"]);
	assert.equal(received[2].data.hello, "scene");
});

test("context and input nodes use the owning program without adding DOM listeners", async () =>
{
	const {LiteGraphScript} = await ready;
	const program = new THREE.Group(); program.type = "Program";
	const scene = new THREE.Scene(); program.add(scene);
	const script = new LiteGraphScript(); scene.add(script);
	program.keyboard = {keyPressed:(key) => key===32,keyJustPressed:() => false,keyJustReleased:() => false};
	program.mouse = {position:{x:20,y:30},delta:{x:2,y:-1},wheel:1,buttonPressed:(button) => button===0,buttonJustPressed:() => false,buttonJustReleased:() => false};
	const contextNode = node(script.graph,"nunu/context");
	const keyboard = node(script.graph,"nunu/keyboard");
	const mouse = node(script.graph,"nunu/mouse");
	await script.initialize(); script.update(0.1);
	assert.equal(contextNode.getOutputData(0),script);
	assert.equal(contextNode.getOutputData(1),scene);
	assert.equal(contextNode.getOutputData(2),scene);
	assert.equal(contextNode.getOutputData(3),program);
	assert.equal(keyboard.getOutputData(0),true);
	assert.deepEqual(Array.from(mouse.getOutputData(0)),[20,30]);
	assert.equal(mouse.getOutputData(3),true);
	keyboard.setProperty("key",65); mouse.setProperty("button",1);
	script.update(0.1);
	assert.equal(keyboard.getOutputData(0),false);
	assert.equal(mouse.getOutputData(3),false);
	script.dispose();
});

test("event transforms apply connected fields only and update static matrices", async () =>
{
	const {LiteGraphScript} = await ready;
	const script = new LiteGraphScript();
	const target = new THREE.Group(); target.matrixAutoUpdate = false; target.scale.set(2,2,2);
	new THREE.Scene().add(script,target);
	const events = node(script.graph,"nunu/events");
	const reference = node(script.graph,"nunu/object"); reference.setProperty("nunu_uuid",target.uuid);
	const vector = node(script.graph,"math3d/xyz-to-vec3"); Object.assign(vector.properties,{x:2,y:3,z:4});
	const setter = node(script.graph,"nunu/transform_set");
	events.connect(0,setter,0); reference.connect(0,setter,1); vector.connect(0,setter,2);
	await script.initialize();
	assert.deepEqual(target.position.toArray(),[2,3,4]);
	assert.deepEqual(target.scale.toArray(),[2,2,2]);
	assert.equal(target.matrix.elements[12],2);
	assert.equal(target.visible,true);
	script.dispose();
});

test("movement integrates seconds, ignores invalid input and supports nested script ownership", async () =>
{
	const {LiteGraphScript} = await ready;
	const script = new LiteGraphScript(); const target = new THREE.Group();
	new THREE.Scene().add(script,target);
	const sub = node(script.graph,"graph/subgraph");
	const events = node(sub.subgraph,"nunu/events");
	const reference = node(sub.subgraph,"nunu/object"); reference.setProperty("nunu_uuid",target.uuid);
	const movement = node(sub.subgraph,"nunu/translate"); movement.setProperty("velocity",[2,0,-1]);
	events.connect(1,movement,0); reference.connect(0,movement,1);
	await script.initialize(); script.update(0.25); script.update(0.25);
	assert.deepEqual(target.position.toArray(),[1,0,-0.5]);
	movement.setProperty("velocity",[Infinity,0,0]); script.update(1);
	assert.deepEqual(target.position.toArray(),[1,0,-0.5]);
	script.dispose();
});

test("first graph edit and nested edits undo, redo and survive close/reopen", async () =>
{
	const {LiteGraphScript, addRotationStarter, seedGraphHistory} = await ready;
	const script = new LiteGraphScript();
	const revision = script.graph.revision;
	seedGraphHistory(script.graph);
	assert.equal(script.graph.revision,revision);
	addRotationStarter(script.graph,"target");
	assert.equal(script.graph._nodes.length,3);
	assert.equal(script.graph.actionHistoryBack(),true);
	assert.equal(script.graph._nodes.length,0);
	assert.equal(script.graph.actionHistoryForward(),true);
	assert.equal(script.graph._nodes.length,3);
	seedGraphHistory(script.graph); // reopening must not clear history
	assert.equal(script.graph.actionHistoryBack(),true);
	assert.equal(script.graph._nodes.length,0);
	const sub = node(script.graph,"graph/subgraph");
	seedGraphHistory(script.graph);
	sub.subgraph.transact("Add nested reference", () => node(sub.subgraph,"nunu/object"));
	assert.equal(sub.subgraph.actionHistoryBack(),true);
	assert.equal(sub.subgraph._nodes.length,0);
});

test("bindings reject other scenes and diagnostics identify unbound and missing references", async () =>
{
	const {LiteGraphScript} = await ready;
	const script = new LiteGraphScript(); const target = new THREE.Group();
	new THREE.Scene().add(script);
	new THREE.Scene().add(target);
	const reference = node(script.graph,"nunu/object");
	script.graph.nunuSelection=() => target;
	let message; script.graph.nunuFeedback=(text) => {message=text;};
	reference.widgets[0].callback();
	assert.equal(reference.properties.nunu_uuid,null);
	assert.match(message,/this script's scene/);
	assert.match(script.getDiagnostics()[0].message,/unbound/);
	reference.setProperty("nunu_uuid",target.uuid);
	assert.match(script.getDiagnostics()[0].message,/missing/);
	assert.match(reference.getTitle(),/Missing/);
	script.parent.add(target);
	assert.equal(script.getDiagnostics().length,0);
	assert.equal(reference.getTitle(),target.type);
});

test("graph schema metadata round-trips and newer versions never run", async () =>
{
	const {LiteGraphScript, ObjectLoader} = await ready;
	const script = new LiteGraphScript();
	assert.equal(script.toJSON().object.graphVersion,1);
	const future = new LiteGraphScript(undefined,99);
	assert.match(future.getDiagnostics()[0].message,/Unsupported/);
	await assert.rejects(future.initialize(),/version 99/);
	const loader = new ObjectLoader();
	assert.equal(loader.parseObject({type:"LiteGraphScript",uuid:"legacy",name:"Legacy"}).graphVersion,1);
});

test("keyboard data gates movement through LiteGraph's standard branch", async () =>
{
	const {LiteGraphScript} = await ready;
	const program=new THREE.Group(); program.type="Program";
	const scene=new THREE.Scene();program.add(scene);
	const target=new THREE.Group();const script=new LiteGraphScript();scene.add(target,script);
	let held=false;
	program.keyboard={keyPressed:()=>held,keyJustPressed:()=>false,keyJustReleased:()=>false};
	const keyboard=node(script.graph,"nunu/keyboard");
	const events=node(script.graph,"nunu/events");
	const reference=node(script.graph,"nunu/object");reference.setProperty("nunu_uuid",target.uuid);
	const branch=node(script.graph,"events/branch");
	const move=node(script.graph,"nunu/translate");
	keyboard.connect(0,branch,1);events.connect(1,branch,0);branch.connect(0,move,0);reference.connect(0,move,1);
	await script.initialize();
	script.update(0.5);assert.equal(target.position.x,0);
	held=true;script.update(0.5);assert.equal(target.position.x,0.5);
	held=false;script.update(0.5);assert.equal(target.position.x,0.5);
	script.dispose();
});

test("packaged JSON and binary examples encode the same portable project", () =>
{
	const {StaticPair}=require("@as-com/pson");
	const json=JSON.parse(fs.readFileSync(path.join(root,"source/files/examples/visual-script-spin.isp"),"utf8"));
	const data=fs.readFileSync(path.join(root,"source/files/examples/visual-script-spin.nsp"));
	const decoded=new StaticPair().decode(data);
	assert.deepEqual(decoded,json);
	const script=decoded.object.children[0].children.find((child)=>child.type==="LiteGraphScript");
	assert.equal(script.graphVersion,1);
	assert.equal(script.graph.nodes.length,3);
	assert.equal(script.graph.nodes[0].properties.nunu_uuid,"33333333-3333-4333-8333-333333333333");
});

test("portable example saves the camera looking at its animated box", () =>
{
	const json=JSON.parse(fs.readFileSync(path.join(root,"source/files/examples/visual-script-spin.isp"),"utf8"));
	const camera=json.object.children[0].children.find((child)=>child.type==="PerspectiveCamera");
	const direction=new THREE.Vector3(0,0,-1).transformDirection(new THREE.Matrix4().fromArray(camera.matrix));
	const expected=new THREE.Vector3(-4,-3,-6).normalize();
	assert.ok(direction.dot(expected)>0.99999);
});

test("catalog is complete, detached and matches the published node schema", async () =>
{
 const {getNunuNodeCatalog,LiteGraph}=await ready;
 const catalog=getNunuNodeCatalog();
 assert.equal(catalog.length,22);
 assert.equal(new Set(catalog.map(n=>n.type)).size,22);
 for(const item of catalog){assert.ok(item.description && item.accepts && item.category);assert.ok(LiteGraph.createNode(item.type));assert.ok(Array.isArray(item.inputs));}
 const published=JSON.parse(fs.readFileSync(path.join(root,"source/files/examples/visual-script-catalog.json")));
 assert.deepEqual(JSON.parse(JSON.stringify(catalog)),published.nodes);
 catalog[0].title="changed";assert.notEqual(getNunuNodeCatalog()[0].title,"changed");
});

test("all eight shared examples execute, round-trip and package identically", async () =>
{
 const {LiteGraphScript,getNunuExampleCatalog,addVisualScriptExample}=await ready;
 const {StaticPair}=require("@as-com/pson");
 for(const example of getNunuExampleCatalog())
 {
  const program=new THREE.Group();program.type="Program";
  const scene=new THREE.Scene();program.add(scene);
  const actor=example.id==="camera"?new THREE.PerspectiveCamera():example.id==="light"?new THREE.DirectionalLight():new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
  const script=new LiteGraphScript();scene.add(actor,script);
  let held=false,pressed=false;
  program.keyboard={keyPressed:()=>held,keyJustPressed:key=>pressed===true?key===32:key===pressed,keyJustReleased:()=>false};
  addVisualScriptExample(script.graph,example.id,actor.uuid);
  const saved=savedGraph(script.graph);script.graph.configure(saved);
  await script.initialize();script.update(0.25);
  if(example.id==="spin") assert.equal(actor.rotation.y,0.25);
  if(example.id==="move"){assert.equal(actor.position.z,0);held=true;script.update(0.25);assert.equal(actor.position.z,-0.5);}
  if(example.id==="visibility"){assert.equal(actor.visible,true);pressed=true;script.update(0.25);assert.equal(actor.visible,false);pressed=false;script.update(0.25);assert.equal(actor.visible,false);}
  if(example.id==="camera") assert.equal(actor.fov,35);
  if(example.id==="light") assert.equal(actor.intensity,2);
  if(example.id==="tint") assert.equal(actor.material.color.getHexString(),"55dd88");
  if(example.id==="spawn"){const spawned=script.graph._nodes.find(n=>n.type==="nunu/objects/spawn").getOutputData(4);assert.ok(spawned.isMesh);assert.equal(spawned.position.x,2);assert.equal(actor.parent,scene);}
  if(example.id==="spawn-delete")
  {
   const spawn=script.graph._nodes.find(n=>n.type==="nunu/objects/spawn");assert.equal(spawn.getOutputData(4),undefined);
   pressed=32;script.update(0.25);const first=spawn.getOutputData(4);assert.ok(first.geometry.type.includes("Sphere"));
   pressed=68;script.update(0.25);assert.equal(first.parent,null);assert.equal(spawn.getOutputData(4),null);
   pressed=32;script.update(0.25);assert.notEqual(spawn.getOutputData(4).uuid,first.uuid);
  }
  script.dispose();
  const json=JSON.parse(fs.readFileSync(path.join(root,`source/files/examples/visual-script-${example.id}.isp`)));
  assert.deepEqual(new StaticPair().decode(fs.readFileSync(path.join(root,`source/files/examples/visual-script-${example.id}.nsp`))),json);
  const packaged=json.object.children[0].children.find(child=>child.type==="LiteGraphScript");
  assert.deepEqual(packaged.graph.nodes.map(n=>n.type),Array.from(example.nodes));
 }
});

async function operationsFixture()
{
 const {LiteGraphScript}=await ready;
 const scene=new THREE.Scene(),script=new LiteGraphScript(),parent=new THREE.Group();
 scene.add(parent,script);parent.position.set(2,0,0);parent.updateMatrix();
 const actor=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());actor.name="Actor";parent.add(actor);
 function operation(type,object=actor){const n=node(script.graph,type);n.getInputData=slot=>slot===1?object:undefined;return n;}
 return {scene,script,parent,actor,operation};
}

test("scene readers and look-at use hierarchy and reject foreign scene objects", async () =>
{
 const {scene,script,parent,actor,operation}=await operationsFixture();
 const find=node(script.graph,"nunu/objects/find");find.setProperty("name","Actor");find.onExecute();assert.equal(find.getOutputData(0),actor);
 const info=node(script.graph,"nunu/objects/info");info.getInputData=()=>actor;info.onExecute();assert.equal(info.getOutputData(3),parent);
 const world=node(script.graph,"nunu/objects/world_transform");world.getInputData=()=>actor;world.onExecute();assert.deepEqual(Array.from(world.getOutputData(0)),[2,0,0]);
 const look=operation("nunu/objects/look_at");look.setProperty("target",[2,0,5]);look.onAction();assert.equal(look.getOutputData(2),true);assert.ok(actor.getWorldDirection(new THREE.Vector3()).z>0.999);
 parent.scale.set(1,2,1);parent.updateMatrix();const before=actor.quaternion.clone();look.onAction();assert.equal(look.getOutputData(2),false);assert.ok(actor.quaternion.equals(before));
 const foreign=new THREE.Group();new THREE.Scene().add(foreign);const hide=operation("nunu/objects/visibility",foreign);hide.onAction();assert.equal(foreign.visible,true);assert.equal(hide.getOutputData(2),false);
 scene.remove(actor);script.dispose();
});

test("data writes validate keys and scalars and expose failure without mutation", async () =>
{
 const {script,actor,operation}=await operationsFixture();
 const set=operation("nunu/data/set");set.onAction();assert.equal(actor.userData.health,100);
 const get=node(script.graph,"nunu/data/get");get.getInputData=()=>actor;get.onExecute();assert.equal(get.getOutputData(0),100);assert.equal(get.getOutputData(1),true);
 set.setProperty("value",Infinity);set.onAction();assert.equal(set.getOutputData(2),false);assert.equal(actor.userData.health,100);
 set.setProperty("key","__proto__");set.setProperty("value",1);set.onAction();assert.equal(set.getOutputData(2),false);assert.equal(Object.getPrototypeOf(actor.userData),Object.prototype);
 set.setProperty("key","enabled");set.setProperty("value",false);set.onAction();assert.equal(actor.userData.enabled,false);
 get.setProperty("key","absent");get.onExecute();assert.equal(get.getOutputData(0),0);assert.equal(get.getOutputData(1),false);script.dispose();
});

test("camera, light and material writes validate atomically and isolate shared resources", async () =>
{
 const {scene,script,actor,operation}=await operationsFixture();
 const camera=new THREE.PerspectiveCamera(50,1,0.1,100),ortho=new THREE.OrthographicCamera();const light=new THREE.DirectionalLight();scene.add(camera,ortho,light);
 const projection=operation("nunu/camera/projection",camera);projection.setProperty("fov",35);projection.onAction();assert.equal(camera.fov,35);
 const matrix=camera.projectionMatrix.clone();projection.setProperty("near",500);projection.setProperty("fov",60);projection.onAction();assert.equal(projection.getOutputData(2),false);assert.equal(camera.fov,35);assert.ok(matrix.equals(camera.projectionMatrix));
 const clipping=operation("nunu/camera/projection",ortho);clipping.setProperty("near",0);clipping.onAction();assert.equal(clipping.getOutputData(2),true);
 const settings=operation("nunu/lights/settings",light);settings.onAction();assert.equal(light.intensity,2);settings.setProperty("color","invalid");settings.setProperty("intensity",5);settings.onAction();assert.equal(light.intensity,2);assert.equal(settings.getOutputData(2),false);
 const original=actor.material;const sibling=new THREE.Mesh(actor.geometry,original);scene.add(sibling);
 const tint=operation("nunu/materials/color");tint.onAction();assert.notEqual(actor.material,original);assert.equal(sibling.material,original);assert.equal(original.color.getHexString(),"ffffff");
 const owned=actor.material;tint.onAction();assert.equal(actor.material,owned);
 const second=operation("nunu/materials/color");second.setProperty("color","#ff0000");second.onAction();assert.equal(actor.material,owned);assert.equal(owned.color.getHexString(),"ff0000");
 const shared=operation("nunu/materials/color",sibling);shared.setProperty("shared",true);shared.onAction();assert.equal(sibling.material,original);assert.equal(original.color.getHexString(),"55dd88");
 tint.setProperty("color",[NaN,0,0]);tint.onAction();assert.equal(tint.getOutputData(2),false);assert.equal(owned.color.getHexString(),"ff0000");script.dispose();
});

test("examples filter compatible actors and each insertion is one undoable transaction", async () =>
{
 const {LiteGraphScript,getNunuExampleCatalog,acceptsExample,addVisualScriptExample,seedGraphHistory}=await ready;
 const scene=new THREE.Scene(),script=new LiteGraphScript(),mesh=new THREE.Mesh(),camera=new THREE.PerspectiveCamera(),light=new THREE.PointLight();scene.add(script,mesh,camera,light);
 for(const example of getNunuExampleCatalog())
 {
  const actor=example.id==="camera"?camera:example.id==="light"?light:mesh;
  assert.equal(acceptsExample(example,actor),true);
  assert.equal(acceptsExample(example,scene),false);
  assert.equal(acceptsExample(example,script),false);
  if(example.accepts!=="Object3D")assert.equal(acceptsExample(example,new THREE.Group()),false);
  seedGraphHistory(script.graph);addVisualScriptExample(script.graph,example.id,actor.uuid);
  assert.equal(script.graph._nodes.length,example.nodes.length);
  script.graph.actionHistoryBack();assert.equal(script.graph._nodes.length,0);
  script.graph.actionHistoryForward();assert.equal(script.graph._nodes.length,example.nodes.length);
  script.graph.clear();
 }
 assert.throws(()=>addVisualScriptExample(script.graph,"unknown",mesh.uuid),/Unknown/);
 assert.throws(()=>addVisualScriptExample(script.graph,"spin",null),/Select/);
 script.dispose();
});

async function spawnFixture()
{
 const fixture=await operationsFixture();
 const spawn=node(fixture.script.graph,"nunu/objects/spawn");
 const remove=node(fixture.script.graph,"nunu/objects/delete");
 spawn.connect(4,remove,1);
 await fixture.script.initialize();
 return {...fixture,spawn,remove};
}

test("spawn validates running state, inputs and limits without mutating authored objects",async()=>
{
 const {script,scene}=await operationsFixture();const spawn=node(script.graph,"nunu/objects/spawn");
 spawn.onAction();assert.equal(spawn.getOutputData(2),false);assert.equal(script.children.length,0);
 await script.initialize();
 for(const [key,value] of [["shape","camera"],["size",0],["size",NaN],["color","red"],["limit",129],["position",[Infinity,0,0]]])
 {
  const before=JSON.parse(JSON.stringify(spawn.properties));spawn.setProperty(key,value);spawn.onAction();assert.equal(spawn.getOutputData(2),false,key);assert.equal(script.children.length,0);Object.assign(spawn.properties,before);
 }
 spawn.setProperty("limit",1);spawn.onAction();const first=spawn.getOutputData(4);assert.equal(first.isMesh,true);assert.equal(scene.getObjectByProperty("uuid",first.uuid),first);
 spawn.onAction();assert.equal(spawn.getOutputData(2),false);assert.equal(spawn.getOutputData(4),first);assert.equal(first.parent.children.length,1);
 script.dispose();assert.equal(script.children.length,0);
});

test("spawn events chain operations and deletion invalidates references and frees owned resources once",async()=>
{
 const {script,spawn,remove,actor}=await spawnFixture();
 const reference=node(script.graph,"nunu/object");reference.setProperty("nunu_uuid",actor.uuid);
 const tint=node(script.graph,"nunu/materials/color");spawn.connect(4,tint,1);spawn.connect(0,tint,0);
 spawn.onAction();const object=spawn.getOutputData(4);assert.equal(object.material.color.getHexString(),"55dd88");
 const geometry=object.geometry,material=object.material;let geometries=0,materials=0;
 geometry.addEventListener("dispose",()=>geometries++);material.addEventListener("dispose",()=>materials++);
 const spawnedRef=node(script.graph,"nunu/object");spawnedRef.setProperty("nunu_uuid",object.uuid);spawnedRef.onExecute();assert.equal(spawnedRef.getOutputData(1),true);
 remove.onAction();assert.equal(remove.getOutputData(2),true);assert.equal(object.parent,null);assert.equal(spawn.getOutputData(4),null);assert.equal(geometries,1);assert.equal(materials,1);
 spawnedRef.onExecute();assert.equal(spawnedRef.getOutputData(0),null);assert.equal(spawnedRef.getOutputData(1),false);
 remove.onAction();assert.equal(remove.getOutputData(2),false);script.dispose();assert.equal(geometries,1);assert.equal(materials,1);assert.ok(actor.parent);
});

test("delete rejects authored, foreign and other-script objects and protects attached children",async()=>
{
 const {script,scene,spawn,remove,actor}=await spawnFixture();
 remove.getInputData=()=>actor;remove.onAction();assert.equal(remove.getOutputData(2),false);assert.ok(actor.parent);
 const other=new entry.namespace.LiteGraphScript();scene.add(other);const otherSpawn=node(other.graph,"nunu/objects/spawn");await other.initialize();otherSpawn.onAction();
 remove.getInputData=()=>otherSpawn.getOutputData(4);remove.onAction();assert.equal(remove.getOutputData(2),false);
 spawn.onAction();const object=spawn.getOutputData(4);const child=new THREE.Group();object.add(child);
 remove.getInputData=()=>object;remove.onAction();assert.equal(remove.getOutputData(2),false);assert.equal(child.parent,object);
 script.graph.stop();assert.equal(child.parent,script);assert.equal(object.parent,null);assert.equal(otherSpawn.getOutputData(4).parent.children.length,1);other.dispose();script.dispose();
});

test("spawn anchor uses world offset under transformed parents and rejects foreign anchors",async()=>
{
 const {script,scene,spawn,actor,parent}=await spawnFixture();
 parent.rotation.y=Math.PI/2;parent.updateMatrix();script.position.set(0,3,0);script.updateMatrix();
 const ref=node(script.graph,"nunu/object");ref.setProperty("nunu_uuid",actor.uuid);ref.connect(0,spawn,1);
 spawn.actionDo("apply");const object=spawn.getOutputData(4);object.updateWorldMatrix(true,false);
 assert.deepEqual(object.getWorldPosition(new THREE.Vector3()).toArray().map(v=>Math.round(v)),[4,0,0]);
 const foreign=new THREE.Group();new THREE.Scene().add(foreign);spawn.getInputData=slot=>slot===1?foreign:undefined;spawn.onAction();assert.equal(spawn.getOutputData(2),false);assert.equal(object.parent.children.length,1);
 script.dispose();assert.equal(scene.getObjectByProperty("uuid",object.uuid),undefined);
});

test("stop, restart, node removal and nested graphs clean spawns without touching authored resources",async()=>
{
 const {script,scene,spawn,actor}=await spawnFixture();let authoredDisposed=0;actor.geometry.addEventListener("dispose",()=>authoredDisposed++);
 spawn.onAction();const first=spawn.getOutputData(4);let freed=0;first.geometry.addEventListener("dispose",()=>freed++);
 script.graph.stop();assert.equal(freed,1);assert.equal(script.children.length,0);assert.equal(spawn.getOutputData(4),null);
 await script.initialize();spawn.onAction();assert.notEqual(spawn.getOutputData(4).uuid,first.uuid);
 script.graph.remove(spawn);assert.equal(script.children.length,0);
 const sub=node(script.graph,"graph/subgraph");const nested=node(sub.subgraph,"nunu/objects/spawn");nested.onAction();assert.equal(nested.getOutputData(2),true);const object=nested.getOutputData(4);
 script.dispose();assert.equal(object.parent,null);assert.equal(scene.getObjectByProperty("uuid",object.uuid),undefined);assert.equal(authoredDisposed,0);
});

test("saving a running graph excludes transient objects and their resources but retains authored children",async()=>
{
 const {script,spawn}=await spawnFixture();const child=new THREE.Group();child.name="Authored child";script.add(child);
 spawn.onAction();const runtime=spawn.getOutputData(4);const data=JSON.parse(JSON.stringify(script.toJSON()));
 assert.equal(data.object.children.length,1);assert.equal(data.object.children[0].uuid,child.uuid);
 assert.equal(data.geometries,undefined);assert.equal(JSON.stringify(data).includes(runtime.uuid),false);
 assert.equal(script.children.length,2);assert.ok(runtime.parent);script.dispose();assert.equal(child.parent,script);
});
