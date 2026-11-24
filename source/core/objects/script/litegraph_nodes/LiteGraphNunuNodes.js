/* eslint-disable camelcase -- LiteGraph public API and persisted UUID property names. */
import {LiteGraph} from "../../../../lib/litegraph.js";

import {ownerGraph, canBindObject, updateObjectMatrix} from "../LiteGraphContext.js";

function NunuObject()
{
	this.addOutput("object", "nunu_object");
	this.addOutput("found", "boolean");
	this.properties = {nunu_uuid: null};
	this._value = null;
	var self = this;
	this.addWidget("button", "use selected", "", function()
	{
		var graph = ownerGraph(self);
		var selected = graph && graph.nunuSelection ? graph.nunuSelection() : null;
		if (graph && canBindObject(graph.nunu_lgscript, selected))
		{
			self.graph.transact("Bind scene object", function()
			{
				self.setProperty("nunu_uuid", selected.uuid);
			});
		}
		else if (graph && graph.nunuFeedback)
		{
			graph.nunuFeedback("Select an object in this script's scene, then bind it.");
		}
	});
}

NunuObject.title = "Nunu Object";
NunuObject.desc = "Reference a scene object by UUID; use selected in the editor to bind it.";

NunuObject.prototype.onConfigure = function()
{
	this._value = null;
};

NunuObject.prototype.refreshObjectByUUID = function()
{
	var graph = ownerGraph(this);
	var scene = graph ? graph.nunu_lgscript.getScene() : null;
	this._value = scene && this.properties.nunu_uuid ? scene.getObjectByProperty("uuid", this.properties.nunu_uuid) || null : null;
	return this._value;
};

NunuObject.prototype.getTitle = function()
{
	var object = this.refreshObjectByUUID();
	return object ? object.name || object.type : this.properties.nunu_uuid ? "Missing object" : "Nunu Object (unbound)";
};

NunuObject.prototype.onPropertyChanged = function(name)
{
	if (name === "nunu_uuid")
	{
		this.refreshObjectByUUID();
		this.setDirtyCanvas(true, true);
	}
};

NunuObject.prototype.onExecute = function()
{
	// Resolve against the current scene, so detached, deleted and reattached
	// targets never retain references to an editor preview or an old program.
	var object = this.refreshObjectByUUID();
	this.setOutputData(0, object);
	this.setOutputData(1, object !== null);
};

function NunuPosition()
{
	this.addInput("object", "nunu_object,object");
	this.addInput("vec3", "vec3");
}

NunuPosition.title = "Set Position";
NunuPosition.desc = "Set a scene object's position from a three-component vector.";

NunuPosition.prototype.onExecute = function()
{
	var object = this.getInputData(0);
	var vector = this.getInputData(1);
	if (!object || !object.position || !vector) { return; }
	if (vector.isVector3)
	{
		object.position.copy(vector);
	}
	else if (vector.length === 3 && Array.from(vector).every(Number.isFinite))
	{
		object.position.set(vector[0], vector[1], vector[2]);
	}
	updateObjectMatrix(object);
};

LiteGraph.registerNodeType("nunu/object", NunuObject);
LiteGraph.registerNodeType("nunu/position_set", NunuPosition);

export {NunuObject, NunuPosition};
