import {LiteGraph} from "../../../../lib/litegraph.js";
import {registerNunuNode} from "../LiteGraphNodeCatalog.js";
import {scriptContext} from "../LiteGraphContext.js";
import {spawnPrimitive, deleteSpawned, releaseSpawns} from "../LiteGraphSpawnContext.js";

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

function SpawnPrimitive()
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
	var self = this;
	for (var index = 0; index < 3; index++)
	{
		(function(axis)
		{
			self.addWidget("number", "position " + ["X", "Y", "Z"][axis], self.properties.position[axis], function(value)
			{
				var position = self.properties.position.slice(); position[axis] = value;
				self.setProperty("position", position);
			}, {precision: 2, step: 0.1});
		})(index);
	}
}
SpawnPrimitive.title = "Spawn Primitive";
SpawnPrimitive.desc = "Spawn a box, sphere or group owned by this running script. Position is script-local, or a world offset from a connected anchor. Cleans up on stop; runtime objects are not saved. Per-node limit 1–128, per-script cap 128.";
SpawnPrimitive.size = [300, 330];
SpawnPrimitive.prototype.onPropertyChanged = function(name, value)
{
	if (name === "position" && value && value.length === 3)
	{
		for (var index = 0; index < 3; index++) { this.widgets[5 + index].value = value[index]; }
	}
};
SpawnPrimitive.prototype.onAction = function(action, param, options)
{
	var self = this;
	report(this, function() { return spawnPrimitive(self); }, options);
};
SpawnPrimitive.prototype.onRemoved = function() { releaseSpawns(scriptContext(this).self, this); this.setOutputData(4, null); };

function DeleteSpawned()
{
	actionPorts(this);
	this.addInput("object", "nunu_object,object");
}
DeleteSpawned.title = "Delete Spawned Object";
DeleteSpawned.desc = "Delete a live primitive owned by this visual script and free its allocated geometry/materials. Authored objects, other scripts' objects and objects with children are rejected. Repeat deletion fails safely.";
DeleteSpawned.size = [280, 170];
DeleteSpawned.prototype.onAction = function(action, param, options)
{
	var self = this;
	report(this, function() { deleteSpawned(self, self.getInputData(1)); }, options);
};

registerNunuNode("nunu/objects/spawn", SpawnPrimitive, {category: "Lifecycle", accepts: "Object3D", effect: "write"});
registerNunuNode("nunu/objects/delete", DeleteSpawned, {category: "Lifecycle", accepts: "Spawned Object3D", effect: "write"});
