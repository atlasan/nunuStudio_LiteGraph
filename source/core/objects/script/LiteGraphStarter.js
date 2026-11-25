import {LiteGraph} from "../../../lib/litegraph.js";
import "./litegraph_nodes/LiteGraphNunuNodes.js";
import "./litegraph_nodes/LiteGraphEngineNodes.js";
import "./litegraph_nodes/LiteGraphObjectNodes.js";
import "./litegraph_nodes/LiteGraphLifecycleNodes.js";
import "./litegraph_nodes/LiteGraphInteractionNodes.js";

/** Stable example IDs; the same builders feed the editor and portable projects. */
const examples = [
	{id: "spin", title: "Spin selected", accepts: "Object3D", description: "Rotate at one radian per second using engine delta.", nodes: ["nunu/object", "nunu/events", "nunu/rotate"]},
	{id: "move", title: "Move while W held", accepts: "Object3D", description: "Hold W to move along parent -Z at two units per second.", nodes: ["nunu/object", "nunu/keyboard", "nunu/events", "events/branch", "nunu/translate"]},
	{id: "visibility", title: "Space toggles visibility", accepts: "Object3D", description: "Press Space to hide/show the selected object.", nodes: ["nunu/object", "nunu/keyboard", "nunu/objects/visibility"]},
	{id: "tint", title: "Tint selected mesh", accepts: "Mesh", description: "Set the mesh green on start without recoloring shared objects.", nodes: ["nunu/object", "nunu/events", "nunu/materials/color"]},
	{id: "camera", title: "Set camera projection", accepts: "PerspectiveCamera", description: "Set perspective FOV to 35 degrees and clipping to 0.1–100 on start.", nodes: ["nunu/object", "nunu/events", "nunu/camera/projection"]},
	{id: "spawn", title: "Spawn box on start", accepts: "Object3D", description: "Spawn a box two world units right of the selected anchor on start. Stop cleans it up.", nodes: ["nunu/object", "nunu/events", "nunu/objects/spawn"]},
	{id: "spawn-delete", title: "Space spawns, D deletes", accepts: "Object3D", description: "Press Space to spawn one sphere beside the anchor; D deletes it. Delete before spawning again; Stop cleans up.", nodes: ["nunu/object", "nunu/keyboard", "nunu/objects/spawn", "nunu/keyboard", "nunu/objects/delete"]},
	{id: "light", title: "Set light intensity", accepts: "Light", description: "Set light intensity to 2 and white color on start.", nodes: ["nunu/object", "nunu/events", "nunu/lights/settings"]},
	{id: "hover-highlight", title: "Highlight on hover", accepts: "Mesh", description: "Turn the mesh yellow while the mouse is over it and blue again when it leaves.", nodes: ["nunu/object", "nunu/input/pointer", "nunu/materials/color", "nunu/materials/color"]},
	{id: "click-copy", title: "Click to copy", accepts: "Mesh", description: "Each click on the mesh adds a copy beside it (up to 8). Stop removes the copies.", nodes: ["nunu/object", "nunu/input/pointer", "nunu/objects/spawn_copy"]},
	{id: "jump", title: "Space jumps when grounded", accepts: "Physics", description: "Press Space to push the physics object up, only while it touches something, so it cannot jump in mid-air.", nodes: ["nunu/object", "nunu/keyboard", "nunu/physics/collision", "events/branch", "nunu/physics/body"]},
	{id: "sound", title: "Space plays a sound", accepts: "Audio", description: "Press Space to play the audio emitter from the start.", nodes: ["nunu/object", "nunu/keyboard", "nunu/audio/playback"]},
	{id: "animation", title: "Space pauses animation", accepts: "Animated", description: "Press Space to pause or resume the object's animation clips.", nodes: ["nunu/object", "nunu/keyboard", "nunu/animation/playback"]}
];

function getNunuExampleCatalog()
{
	return JSON.parse(JSON.stringify(examples));
}

function acceptsExample(example, object)
{
	return Boolean(example && object && object.isObject3D && object.type !== "Scene" && object.type !== "Program" && object.type !== "LiteGraphScript" &&
		(example.accepts === "Object3D" || example.accepts === "Mesh" && object.isMesh || example.accepts === "PerspectiveCamera" && object.isPerspectiveCamera || example.accepts === "Light" && object.isLight ||
		example.accepts === "Physics" && object.type === "Physics" || example.accepts === "Audio" && (object.type === "Audio" || object.type === "PositionalAudio") ||
		example.accepts === "Animated" && Array.isArray(object.animations) && object.animations.length > 0));
}

/** Append, never replace; one example is one transaction and scene mutation waits for Run. */
function addVisualScriptExample(graph, id, uuid)
{
	var example = examples.find(function(item) { return item.id === id; });
	if (!example) { throw new Error("Unknown visual script example: " + id); }
	if (!uuid) { throw new Error("Select an object in this script's scene first."); }
	return graph.transact(example.title, function()
	{
		var offset = graph._nodes.reduce(function(right, node) { return Math.max(right, node.pos[0] + node.size[0] + 80); }, 40);
		var nodes = example.nodes.map(function(type, index)
		{
			var node = LiteGraph.createNode(type);
			node.pos = [offset + Math.floor(index / 2) * 320, 60 + index % 2 * 380];
			graph.add(node);
			return node;
		});
		nodes[0].setProperty("nunu_uuid", uuid);
		if (id === "jump")
		{
			nodes[0].connect(0, nodes[2], 0);
			nodes[0].connect(0, nodes[4], 1);
			nodes[1].connect(1, nodes[3], 0);
			nodes[2].connect(0, nodes[3], 1);
			nodes[3].connect(0, nodes[4], 0);
		}
		else if (id === "sound" || id === "animation")
		{
			nodes[2].setProperty("operation", id === "sound" ? "restart" : "toggle");
			nodes[0].connect(0, nodes[2], 1);
			nodes[1].connect(1, nodes[2], 0);
		}
		else if (id === "hover-highlight")
		{
			nodes[2].setProperty("color", "#ffcc44");
			nodes[3].setProperty("color", "#66bbff");
			nodes[0].connect(0, nodes[1], 0);
			nodes[0].connect(0, nodes[2], 1);
			nodes[0].connect(0, nodes[3], 1);
			nodes[1].connect(3, nodes[2], 0);
			nodes[1].connect(4, nodes[3], 0);
		}
		else if (id === "click-copy")
		{
			nodes[0].connect(0, nodes[1], 0);
			nodes[0].connect(0, nodes[2], 1);
			nodes[1].connect(5, nodes[2], 0);
		}
		else if (id === "spawn-delete")
		{
			nodes[2].setProperty("shape", "sphere");
			nodes[2].setProperty("limit", 1);
			nodes[3].setProperty("key", 68);
			nodes[0].connect(0, nodes[2], 1);
			nodes[1].connect(1, nodes[2], 0);
			nodes[2].connect(4, nodes[4], 1);
			nodes[3].connect(1, nodes[4], 0);
		}
		else if (id === "move")
		{
			nodes[1].setProperty("key", 87);
			nodes[4].setProperty("velocity", [0, 0, -2]);
			nodes[0].connect(0, nodes[4], 1);
			nodes[1].connect(0, nodes[3], 1);
			nodes[2].connect(1, nodes[3], 0);
			nodes[3].connect(0, nodes[4], 0);
			nodes[2].connect(5, nodes[4], 3);
		}
		else
		{
			nodes[0].connect(0, nodes[2], 1);
			if (id === "visibility") { nodes[1].connect(1, nodes[2], 0); }
			else
			{
				nodes[1].connect(id === "spin" ? 1 : 0, nodes[2], 0);
				if (id === "spin") { nodes[1].connect(5, nodes[2], 3); }
				if (id === "camera") { nodes[2].setProperty("fov", 35); }
			}
		}
		return nodes;
	}, {rollback: true});
}

function addRotationStarter(graph, uuid)
{
	return addVisualScriptExample(graph, "spin", uuid);
}

export {getNunuExampleCatalog, acceptsExample, addVisualScriptExample, addRotationStarter};
