/* eslint-disable camelcase -- LiteGraph public API and persisted UUID property names. */
import {Group, Object3D} from "three";
import {LiteGraphRuntime} from "./LiteGraphRuntime.js";
import "./litegraph_nodes/LiteGraphNunuNodes.js";

/**
 * Visual script stored with the scene and executed by its frame lifecycle.
 *
 * @class LiteGraphScript
 * @module Script
 */
function LiteGraphScript(dataGraph)
{
	Group.call(this);
	this.type = "LiteGraphScript";
	this.name = "LGScript";
	this.graph = new LiteGraphRuntime();
	this.graph.nunu_lgscript = this;
	this.ready = Promise.resolve(false);
	if (dataGraph) { this.configure(dataGraph); }
}

LiteGraphScript.prototype = Object.create(Group.prototype);

LiteGraphScript.prototype.configure = function(dataGraph)
{
	this.graph.configure(dataGraph);
};

LiteGraphScript.prototype.getProgram = function()
{
	var node = this.parent;
	while (node !== null)
	{
		if (node.type === "Program") { return node; }
		node = node.parent;
	}
	return null;
};

LiteGraphScript.prototype.initialize = function()
{
	Object3D.prototype.initialize.call(this);
	this.ready = this.graph.start();
	// Scene initialization is synchronous. Preserve rejection for callers while
	// also reporting it when the host does not await script.ready.
	this.ready.catch(function(error)
	{
		console.error("nunuStudio: Visual script initialization failed", error);
	});
	return this.ready;
};

LiteGraphScript.prototype.update = function(delta)
{
	this.graph.tick(delta);
	Object3D.prototype.update.call(this, delta);
};

LiteGraphScript.prototype.dispose = function()
{
	try
	{
		this.graph.stop({dropQueued: true});
	}
	finally
	{
		Object3D.prototype.dispose.call(this);
	}
};

LiteGraphScript.prototype.resize = function(x, y)
{
	this.graph.sendEventToAllNodes("onResize", [x, y], null);
};

LiteGraphScript.prototype.appData = function(data)
{
	this.graph.sendEventToAllNodes("onAppData", [data], null);
};

/** Remap references internal to a pasted selection, preserving external UUIDs. */
LiteGraphScript.prototype.remapReferences = function(uuids)
{
	function remap(graph)
	{
		for (var node of graph._nodes)
		{
			if (node.type === "nunu/object" && uuids.has(node.properties.nunu_uuid))
			{
				node.setProperty("nunu_uuid", uuids.get(node.properties.nunu_uuid));
			}
			if (node.subgraph) { remap(node.subgraph); }
		}
	}
	remap(this.graph);
};

LiteGraphScript.prototype.toJSON = function(meta)
{
	var data = Object3D.prototype.toJSON.call(this, meta);
	data.object.graph = this.graph.serialize();
	return data;
};

export {LiteGraphScript};
