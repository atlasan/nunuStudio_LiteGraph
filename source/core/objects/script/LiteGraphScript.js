/* eslint-disable camelcase -- LiteGraph public API and persisted UUID property names. */
import {Group, Object3D} from "three";
import {LiteGraph} from "../../../lib/litegraph.js";
import {LiteGraphRuntime} from "./LiteGraphRuntime.js";
import "./litegraph_nodes/LiteGraphNunuNodes.js";
import "./litegraph_nodes/LiteGraphEngineNodes.js";

/**
 * Visual script stored with the scene and executed by its frame lifecycle.
 *
 * @class LiteGraphScript
 * @module Script
 */
function LiteGraphScript(dataGraph, graphVersion)
{
	Group.call(this);
	this.type = "LiteGraphScript";
	this.name = "Visual Script";
	this.graphVersion = graphVersion === undefined ? 1 : graphVersion;
	this.graph = new LiteGraphRuntime();
	this.graph.nunu_lgscript = this;
	this.ready = Promise.resolve(false);
	this.pendingAppData = [];
	this.initializing = false;
	this.lastError = null;
	var self = this;
	this.graph.events.on("node-error", function(event) { self.lastError = event.detail.error; });
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
	this.initializing = true;
	var request = {};
	this.startRequest = request;
	this.lastError = null;
	var self = this;
	var startup = this.graphVersion === 1 ? this.graph.start() : Promise.reject(new Error("Unsupported visual script version " + this.graphVersion));
	this.ready = startup.then(function(started)
	{
		if (self.startRequest !== request) { return false; }
		self.initializing = false;
		if (started)
		{
			if (self.viewportSize) { self.resize(self.viewportSize[0], self.viewportSize[1]); }
			var messages = self.pendingAppData;
			self.pendingAppData = [];
			for (var message of messages) { self.appData(message); }
		}
		return started;
	});
	// Scene initialization is synchronous. Preserve rejection for callers while
	// also reporting it when the host does not await script.ready.
	this.ready.catch(function(error)
	{
		if (self.startRequest !== request) { return; }
		self.initializing = false;
		self.pendingAppData = [];
		self.lastError = error;
		console.error("nunuStudio: Visual script initialization failed: " + self.name, error);
	});
	return this.ready;
};

LiteGraphScript.prototype.update = function(delta)
{
	try
	{
		this.graph.tick(delta);
		if (this.graph.errors_in_execution) { throw this.lastError || new Error("Graph execution failed"); }
	}
	catch (error)
	{
		this.lastError = error;
		throw new Error("Visual script \"" + this.name + "\"" + (error.node ? " node " + error.node.id : "") + ": " + error.message);
	}
	Object3D.prototype.update.call(this, delta);
};

LiteGraphScript.prototype.dispose = function()
{
	this.initializing = false;
	this.startRequest = null;
	this.pendingAppData = [];
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
	this.viewportSize = [x, y];
	if (!this.initializing) { this.graph.sendEventToAllNodes("onResize", [x, y], null); }
};

LiteGraphScript.prototype.appData = function(data)
{
	if (this.initializing) { this.pendingAppData.push(data); }
	else { this.graph.sendEventToAllNodes("onAppData", [data], null); }
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

/** Diagnose documents without running them or mutating the scene. */
LiteGraphScript.prototype.getDiagnostics = function()
{
	var issues = [];
	var scene = this.getScene();
	if (this.graphVersion !== 1)
	{
		issues.push({severity: "error", message: "Unsupported visual script version " + this.graphVersion});
	}
	function visit(graph, path)
	{
		for (var node of graph._nodes)
		{
			var nodePath = path.concat(node.id).join("/");
			var message = null;
			var severity = "warning";
			if (!LiteGraph.registered_node_types[node.type]) { message = "Missing node type: " + node.type; severity = "error"; }
			else if (node.initialization_error) { message = "Node dependency failed: " + node.initialization_error.message; severity = "error"; }
			else if (node.type === "nunu/object")
			{
				if (!node.properties.nunu_uuid) { message = "Object reference is unbound. Select a scene object and use Bind selected."; }
				else if (scene && !scene.getObjectByProperty("uuid", node.properties.nunu_uuid)) { message = "Referenced object is missing from this scene."; }
			}
			else if (node.type === "nunu/keyboard" && (!Number.isInteger(Number(node.properties.key)) || node.properties.key < 0 || node.properties.key > 255))
			{
				message = "Keyboard key code must be between 0 and 255.";
			}
			if (message) { issues.push({severity: severity, node: nodePath, message: message}); }
			if (node.subgraph) { visit(node.subgraph, path.concat(node.id)); }
		}
	}
	visit(this.graph, []);
	return issues;
};

LiteGraphScript.prototype.toJSON = function(meta)
{
	var data = Object3D.prototype.toJSON.call(this, meta);
	data.object.graph = this.graph.serialize();
	data.object.graphVersion = this.graphVersion;
	return data;
};

export {LiteGraphScript};
