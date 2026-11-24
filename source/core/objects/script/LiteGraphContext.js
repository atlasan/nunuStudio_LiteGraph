/** Runtime-only ownership and object helpers, also used by editor diagnostics. */
function ownerGraph(node)
{
	var graph = node.graph;
	while (graph && !graph.nunu_lgscript)
	{
		graph = graph._subgraph_node ? graph._subgraph_node.graph : null;
	}
	return graph;
}

function scriptContext(node)
{
	var graph = ownerGraph(node);
	var self = graph ? graph.nunu_lgscript : null;
	return {
		self: self,
		parent: self ? self.parent : null,
		scene: self ? self.getScene() : null,
		program: self ? self.getProgram() : null,
		graph: graph
	};
}

function canBindObject(script, object)
{
	var scene = script.getScene();
	return Boolean(scene && object && object.isObject3D && scene.getObjectByProperty("uuid", object.uuid) === object);
}

function vectorComponents(value)
{
	if (value && value.isVector3) { value = [value.x, value.y, value.z]; }
	if (!value || value.length !== 3) { return null; }
	var result = Array.from(value);
	return result.every(Number.isFinite) ? result : null;
}

/** Keep static objects in sync too; the engine leaves matrixAutoUpdate off for them. */
function updateObjectMatrix(object)
{
	object.updateMatrix();
	object.matrixWorldNeedsUpdate = true;
}

export {ownerGraph, scriptContext, canBindObject, vectorComponents, updateObjectMatrix};
