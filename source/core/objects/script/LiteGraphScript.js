import {Group} from "three";
import {LGraph, LiteGraph} from "../../../lib/litegraph/litegraph.mini.js";
import {owners, scriptContext, canBindObject, vectorComponents, updateObjectMatrix} from "./LiteGraphContext.js";
import {authoredChildren, releaseSpawns} from "./LiteGraphSpawnContext.js";
import {registerNunuNode} from "./LiteGraphNodeCatalog.js";
import "./litegraph_nodes/LiteGraphEngineNodes.js";
import "./litegraph_nodes/LiteGraphInputNodes.js";
import "./litegraph_nodes/LiteGraphObjectNodes.js";
import "./litegraph_nodes/LiteGraphLifecycleNodes.js";
import "./litegraph_nodes/LiteGraphInteractionNodes.js";

function getSceneObject(node, uuid)
{
	const {scene} = scriptContext(node);
	return uuid && scene ? scene.getObjectByProperty("uuid", uuid) : undefined;
}

class NunuObject
{
	static get title() {return "Scene Object";}
	static get desc() {return "Resolve a scene object by its saved UUID.";}

	constructor()
	{
		this.addOutput("object", "nunu_object");
		this.addOutput("found", "boolean");
		this.addProperty("nunu_uuid", "", "string");
	}

	onExecute()
	{
		const object = getSceneObject(this, this.properties.nunu_uuid) ?? null;
		this.setOutputData(0, object);
		this.setOutputData(1, object !== null);
	}

	bindObject(object)
	{
		const {self} = scriptContext(this);
		if (!self || !canBindObject(self, object))
		{
			return false;
		}

		this.setProperty("nunu_uuid", object.uuid);
		return true;
	}
}

class NunuPosition
{
	static get title() {return "Set Position";}
	static get desc() {return "Set a scene object's position from a three-component vector.";}

	constructor()
	{
		this.addInput("object", "nunu_object,object");
		this.addInput("vec3", "vec3");
	}

	onExecute()
	{
		const object = this.getInputData(0);
		const position = vectorComponents(this.getInputData(1));
		if (object && object.isObject3D && position)
		{
			object.position.set(position[0], position[1], position[2]);
			updateObjectMatrix(object);
		}
	}
}

registerNunuNode("nunu/object", NunuObject, {category: "Scene", accepts: "Object3D", effect: "read"});
registerNunuNode("nunu/position_set", NunuPosition, {category: "Transforms", accepts: "Object3D", effect: "write"});

function setGraphFrame(graph, time, delta, program)
{
	graph.starttime = 0;
	graph.last_update_time = (time - delta) * 1000;
	graph.globaltime = time;
	graph.elapsed_time = delta;
	graph.fixedtime_lapse = delta;
	for (const node of graph._nodes)
	{
		// Publish input values before event nodes can dispatch actions in this step.
		if (program && node.mode === LiteGraph.ALWAYS && node.samplePreviewInput)
		{
			node.samplePreviewInput(program);
		}
		if (node.subgraph)
		{
			setGraphFrame(node.subgraph, time, delta, program);
		}
	}
}

/**
 * A scene object whose behavior is driven by a saved LiteGraph document.
 * @class LiteGraphScript
 * @extends Group
 */
class LiteGraphScript extends Group
{
	constructor(data, graphVersion = 1)
	{
		super();

		this.type = "LiteGraphScript";
		this.name = "LiteGraph Script";
		this.graphVersion = graphVersion;
		this.engineTime = 0;
		this.viewportSize = null;
		this.graph = new LGraph();
		owners.set(this.graph, this);
		if (data !== undefined)
		{
			// The loader may reuse its input when cloning a project for Play.
			const result = this.graph.configureValidated(data, {repair: true});
			if (!result.ok)
			{
				const issue = result.report.issues.find((entry) => entry.severity === "error");
				throw new Error("Invalid LiteGraph script: " + (issue ? issue.message : "graph validation failed"));
			}
		}
	}

	initialize()
	{
		super.initialize();
		if (this.graphVersion !== 1)
		{
			throw new Error("Unsupported visual script version " + this.graphVersion);
		}
		this.engineTime = 0;
		setGraphFrame(this.graph, 0, 0);
		const started = this.graph.start(0, {manual: true});
		const resize = () =>
		{
			if (this.viewportSize !== null && this.graph.status === LGraph.STATUS_RUNNING)
			{
				this.graph.sendEventToAllNodes("onResize", this.viewportSize, null);
			}
		};
		if (started instanceof Promise)
		{
			return started.then((running) =>
			{
				if (running) {resize();}
				return running;
			});
		}
		resize();
		return started;
	}

	getProgram()
	{
		for (let parent = this.parent; parent !== null; parent = parent.parent)
		{
			if (parent.type === "Program")
			{
				return parent;
			}
		}
		return null;
	}

	resize(width, height)
	{
		this.viewportSize = [width, height];
		if (this.graph.status === LGraph.STATUS_RUNNING)
		{
			this.graph.sendEventToAllNodes("onResize", this.viewportSize, null);
		}
	}

	appData(data)
	{
		if (this.graph.status === LGraph.STATUS_RUNNING)
		{
			this.graph.sendEventToAllNodes("onAppData", [data], null);
		}
	}

	update(delta)
	{
		if (this.graph.status === LGraph.STATUS_RUNNING)
		{
			const step = Number.isFinite(delta) && delta >= 0 ? delta : 0;
			this.engineTime += step;
			setGraphFrame(this.graph, this.engineTime, step, this.getProgram());
			// Time nodes and nested graphs read the same simulation clock during this frame.
			const previousClock = LiteGraph.getTime;
			LiteGraph.getTime = () => this.engineTime * 1000;
			try
			{
				this.graph.processCallbackHandlers("onBeforeStep", {def_cb: this.graph.onBeforeStep});
				this.graph.runStep();
				this.graph.globaltime = this.engineTime;
				this.graph.processCallbackHandlers("onAfterStep", {def_cb: this.graph.onAfterStep});
			}
			finally
			{
				LiteGraph.getTime = previousClock;
			}
		}
		super.update(delta);
	}

	dispose()
	{
		try
		{
			this.graph.stop({dropQueued: true});
		}
		finally
		{
			releaseSpawns(this);
			super.dispose();
		}
	}

	toJSON(meta)
	{
		const children = authoredChildren(this);
		const view = children === this.children ? this : Object.assign(Object.create(this), {children});
		const data = super.toJSON.call(view, meta);
		data.object.graph = this.graph.serialize();
		data.object.graphVersion = this.graphVersion;
		return data;
	}
}

export {LiteGraphScript};
