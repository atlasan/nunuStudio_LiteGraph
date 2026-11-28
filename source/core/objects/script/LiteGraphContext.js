/** Runtime-only ownership and object helpers. */
const owners = new WeakMap();
const inputFrames = new WeakMap();

// A nested graph can run more than once during the same program input sample.
function firstInputFrame(node, program)
{
	if (!program || node.graph.ancestorsCall || inputFrames.get(node) === program.inputFrame)
	{
		return false;
	}
	inputFrames.set(node, program.inputFrame);
	return true;
}

function scriptContext(node)
{
	const graph = node.graph && node.graph.rootGraph;
	const self = graph && owners.get(graph);
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

export {owners, scriptContext, canBindObject, vectorComponents, updateObjectMatrix, firstInputFrame};
