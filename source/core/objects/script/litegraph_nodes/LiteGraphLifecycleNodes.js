import {LiteGraph} from "../../../../lib/litegraph/litegraph.mini.js";
import {registerNunuNode} from "../LiteGraphNodeCatalog.js";
import {scriptContext} from "../LiteGraphContext.js";
import {spawnPrimitive, spawnCopy, deleteSpawned, releaseSpawns} from "../LiteGraphSpawnContext.js";

function actionPorts(node)
{
	node.mode = LiteGraph.ON_EVENT;
	node.addInput("apply", LiteGraph.ACTION);
	node.addOutput("done", LiteGraph.EVENT);
	node.addOutput("failed", LiteGraph.EVENT);
	node.addOutput("success", "boolean");
	node.addOutput("message", "string");
}

function report(node, operation, options)
{
	var value;
	try { value = operation(); }
	catch (error)
	{
		node.setOutputData(2, false);
		node.setOutputData(3, error.message);
		node.triggerSlot(1, error.message, null, options);
		return;
	}
	node.setOutputData(2, true);
	node.setOutputData(3, "");
	// Refresh output data before the event so chained actions see this spawn.
	if (node.outputs.length > 4) { node.setOutputData(4, value); }
	node.triggerSlot(0, value, null, options);
}

/** X/Y/Z number widgets editing one vector property; widgets follow later property changes. */
function vectorWidgets(node, property, label)
{
	var widgets = [];
	for (var index = 0; index < 3; index++)
	{
		(function(axis)
		{
			widgets.push(node.addWidget("number", label + " " + ["X", "Y", "Z"][axis], node.properties[property][axis], function(value)
			{
				var vector = node.properties[property].slice(); vector[axis] = value;
				node.setProperty(property, vector);
			}, {precision: 2, step: 0.1}));
		})(index);
	}
	return widgets;
}

function syncVectorWidgets(widgets, value)
{
	if (widgets && value && value.length === 3)
	{
		for (var index = 0; index < 3; index++) { widgets[index].value = value[index]; }
	}
}

class SpawnPrimitive
{
	constructor()
	{
		actionPorts(this);
		this.addInput("anchor", "nunu_object,object");
		this.addInput("position", "vec3");
		this.addOutput("object", "nunu_object");
		this.properties = {shape: "box", name: "Spawned object", position: [2, 0, 0], size: 1, color: "#ffbb55", limit: 32};
		this.addWidget("combo", "shape", "box", null, {property: "shape", values: ["box", "sphere", "group"]});
		this.addWidget("text", "name", this.properties.name, null, {property: "name"});
		this.addWidget("number", "size / diameter", 1, null, {property: "size", precision: 2, step: 0.1});
		this.addWidget("text", "hex color", this.properties.color, null, {property: "color"});
		this.addWidget("number", "live limit", 32, null, {property: "limit", precision: 0, step: 1});
		this.positionWidgets = vectorWidgets(this, "position", "position");
	}

	onPropertyChanged(name, value)
	{
		if (name === "position") { syncVectorWidgets(this.positionWidgets, value); }
	}

	onAction(action, param, options)
	{
		var self = this;
		report(this, function() { return spawnPrimitive(self); }, options);
	}

	onRemoved() { releaseSpawns(scriptContext(this).self, this); this.setOutputData(4, null); }
}
SpawnPrimitive.title = "Spawn Primitive";
SpawnPrimitive.desc = "Spawn a box, sphere or group owned by this running script. Position is script-local, or a world offset from a connected anchor. Cleans up on stop; runtime objects are not saved. Per-node limit 1–128, per-script cap 128.";
SpawnPrimitive.size = [300, 330];

class SpawnCopy
{
	constructor()
	{
		actionPorts(this);
		this.addInput("source", "nunu_object,object");
		this.addInput("offset", "vec3");
		this.addOutput("object", "nunu_object");
		this.properties = {offset: [1.5, 0, 0], stack: true, limit: 8};
		this.addWidget("toggle", "stack copies", true, null, {property: "stack"});
		this.addWidget("number", "live limit", 8, null, {property: "limit", precision: 0, step: 1});
		this.offsetWidgets = vectorWidgets(this, "offset", "offset");
	}

	onPropertyChanged(name, value)
	{
		if (name === "offset") { syncVectorWidgets(this.offsetWidgets, value); }
	}

	onAction(action, param, options)
	{
		var self = this;
		report(this, function() { return spawnCopy(self, self.getInputData(1)); }, options);
	}
}
SpawnCopy.title = "Spawn Copy";
SpawnCopy.desc = "Copy an authored object (meshes, groups, lights) into this running script. The copy keeps the source's world rotation and scale, is placed at a world offset from it (stacked per live copy), shares its geometry and materials, and is removed on stop. Objects with scripts, physics, audio or cameras are rejected.";
SpawnCopy.size = [300, 250];
SpawnCopy.prototype.onRemoved = SpawnPrimitive.prototype.onRemoved;

class DeleteSpawned
{
	constructor()
	{
		actionPorts(this);
		this.addInput("object", "nunu_object,object");
	}

	onAction(action, param, options)
	{
		var self = this;
		report(this, function() { deleteSpawned(self, self.getInputData(1)); }, options);
	}
}
DeleteSpawned.title = "Delete Spawned Object";
DeleteSpawned.desc = "Delete a live primitive or copy owned by this visual script and free its allocated geometry/materials. Authored objects, other scripts' objects and objects with children are rejected. Repeat deletion fails safely.";
DeleteSpawned.size = [280, 170];

registerNunuNode("nunu/objects/spawn", SpawnPrimitive, {category: "Lifecycle", accepts: "Object3D", effect: "write"});
registerNunuNode("nunu/objects/spawn_copy", SpawnCopy, {category: "Lifecycle", accepts: "Object3D", effect: "write"});
registerNunuNode("nunu/objects/delete", DeleteSpawned, {category: "Lifecycle", accepts: "Spawned Object3D", effect: "write"});
