/* eslint-disable camelcase -- LiteGraph history API. */
import {LiteGraph} from "../../../../lib/litegraph.js";

/** Seed the library's undo baseline without changing the saved document. */
function seedGraphHistory(graph)
{
	LiteGraph.actionHistory_enabled = true;
	if (graph.history.actionHistoryVersions.length === 0)
	{
		var snapshot = graph.serialize({format: "inline"});
		var version = graph._version;
		var revision = graph.revision;
		graph.onGraphChanged({action: "Initial visual script"});
		graph.history.actionHistory[graph.history.actionHistoryPtr].graphSave = snapshot;
		graph._version = version;
		graph.revision = revision;
	}
	for (var node of graph._nodes)
	{
		if (node.subgraph) { seedGraphHistory(node.subgraph); }
	}
}

export {seedGraphHistory};
