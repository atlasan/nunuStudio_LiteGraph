import {LiteGraph} from "../../../lib/litegraph.js";
import "./litegraph_nodes/LiteGraphNunuNodes.js";
import "./litegraph_nodes/LiteGraphEngineNodes.js";

/** Append a portable, undoable example without changing any scene objects. */
function addRotationStarter(graph, uuid)
{
	if (!uuid) { throw new Error("Select an object in this script's scene first."); }
	return graph.transact("Spin selected object", function()
	{
		var offset = graph._nodes.reduce(function(right, node)
		{
			return Math.max(right, node.pos[0] + node.size[0] + 80);
		}, 40);
		var reference = LiteGraph.createNode("nunu/object");
		var events = LiteGraph.createNode("nunu/events");
		var rotate = LiteGraph.createNode("nunu/rotate");
		reference.pos = [offset, 60];
		events.pos = [offset, 240];
		rotate.pos = [offset + 320, 80];
		graph.add(reference);
		graph.add(events);
		graph.add(rotate);
		reference.setProperty("nunu_uuid", uuid);
		reference.connect(0, rotate, 1);
		events.connect(1, rotate, 0);
		events.connect(5, rotate, 3);
		return [reference, events, rotate];
	}, {rollback: true});
}

export {addRotationStarter};
