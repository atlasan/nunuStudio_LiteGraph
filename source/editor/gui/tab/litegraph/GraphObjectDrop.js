/* eslint-disable camelcase -- LiteGraph public API and persisted UUID property names. */
import {LiteGraph} from "../../../../lib/litegraph.js";
import {canBindObject} from "../../../../core/objects/script/LiteGraphContext.js";

/** Whether a node input accepts scene object references. */
function acceptsObject(input)
{
	return Boolean(input && typeof input.type === "string" && input.type.split(",").includes("nunu_object"));
}

/** Objects a reference node may bind: in the script's scene, never the scene, program or the script itself. */
function canReference(script, object)
{
	return Boolean(script && canBindObject(script, object) && object !== script && !object.isScene && object.type !== "Program");
}

/**
 * Drop a scene object on a graph, as one undoable step:
 * - on a Nunu Object node: rebind it;
 * - on an object input of another node: add a bound reference to its left and connect it;
 * - anywhere else: add a bound reference at the drop position.
 *
 * @param {LGraph} graph Graph being edited (root or subgraph of the script).
 * @param {LiteGraphScript} script Script owning the graph.
 * @param {Object3D} object Dropped scene object.
 * @param {Array} position Drop position in graph coordinates.
 * @param {LGraphNode} [target] Node under the drop position.
 * @param {number} [slot] Input slot of target under the drop position, -1 for none.
 * @return {Object} {ok, message, node}
 */
function dropSceneObject(graph, script, object, position, target, slot)
{
	if (!canReference(script, object))
	{
		return {ok: false, message: "Drop an object from this script's scene (not the scene or program itself)."};
	}
	var label = object.name || object.type;
	if (target && target.type === "nunu/object")
	{
		graph.transact("Bind " + label, function() { target.setProperty("nunu_uuid", object.uuid); });
		return {ok: true, message: "Bound " + target.title + " to " + label + ".", node: target};
	}
	var input = target && slot >= 0 && target.inputs ? target.inputs[slot] : null;
	if (target && input && !acceptsObject(input))
	{
		return {ok: false, message: "Input " + input.name + " of " + target.title + " does not take scene objects."};
	}
	var node;
	graph.transact("Reference " + label, function()
	{
		node = LiteGraph.createNode("nunu/object");
		if (input)
		{
			var anchor = target.getConnectionPos(true, slot);
			node.pos = [target.pos[0] - node.size[0] - 60, anchor[1] - node.size[1] / 2];
		}
		else
		{
			node.pos = [position[0], position[1]];
		}
		graph.add(node);
		node.setProperty("nunu_uuid", object.uuid);
		if (input) { node.connect(0, target, slot); }
	});
	return {ok: true, message: input ? "Connected " + label + " to " + target.title + " (" + input.name + ")." : "Added a reference to " + label + ".", node: node};
}

export {dropSceneObject, canReference, acceptsObject};
