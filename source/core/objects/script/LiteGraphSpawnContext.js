import {Group, Mesh, BoxGeometry, SphereGeometry, MeshStandardMaterial, Vector3, Matrix4} from "three";
import {LGraph} from "../../../lib/litegraph/litegraph.mini.js";
import {scriptContext, vectorComponents} from "./LiteGraphContext.js";

// Runtime ownership never enters userData or saved graph properties.
const sessions = new WeakMap();
const owners = new WeakMap();
// Every object inside a spawn (including the spawn itself) maps to the spawned root.
const roots = new WeakMap();
const maxObjects = 128;

function isLiveSession(node)
{
	var context = scriptContext(node);
	return context.self && context.scene && context.graph.status === LGraph.STATUS_RUNNING ? context : null;
}

function liveObject(context, object)
{
	return Boolean(object && object.isObject3D && context.scene.getObjectByProperty("uuid", object.uuid) === object);
}

/** Validate the shared spawn limits; returns this script's session (or null before the first spawn). */
function checkLimit(context, node, limit)
{
	if (!Number.isInteger(limit) || limit < 1 || limit > maxObjects) { throw new Error("Use a live limit from 1 to 128."); }
	var session = sessions.get(context.self);
	if (countOwned(session, node) >= limit || session && session.objects.size >= maxObjects) { throw new Error("Spawn limit reached; delete an owned object before spawning again."); }
	return session;
}

function countOwned(session, node)
{
	return session ? Array.from(session.objects.values()).filter(function(entry) { return entry.node === node; }).length : 0;
}

/** Register an object as owned by this running script; resources are disposed with it. */
function adopt(context, session, node, object, resources)
{
	if (!session)
	{
		var container = new Group();
		container.name = "Runtime spawns";
		context.self.add(container);
		session = {container: container, objects: new Map()};
		sessions.set(context.self, session);
	}
	var parts = new Set();
	object.traverse(function(part)
	{
		if (part !== object) { parts.add(part); }
		roots.set(part, object);
	});
	session.objects.set(object, {node: node, resources: resources, parts: parts});
	owners.set(object, context.self);
	session.container.add(object);
	return object;
}

function spawnPrimitive(node)
{
	var context = isLiveSession(node);
	if (!context) { throw new Error("Spawning requires a running visual script in a scene."); }
	var position = vectorComponents(node.getInputOrProperty("position"));
	var size = node.properties.size;
	if (!["box", "sphere", "group"].includes(node.properties.shape) || !position || !Number.isFinite(size) || size <= 0 || !Number.isInteger(node.properties.limit) || typeof node.properties.name !== "string" || !/^#[0-9a-f]{6}$/i.test(node.properties.color))
	{
		throw new Error("Use a primitive, finite position, positive size, hex color and a limit from 1 to 128.");
	}
	var anchor = node.getInputData(1);
	if (node.isInputConnected(1) && !liveObject(context, anchor))
	{
		throw new Error("Anchor must be a live object in this script's scene.");
	}
	var session = checkLimit(context, node, node.properties.limit);
	var point = new Vector3().fromArray(position);
	if (node.isInputConnected(1))
	{
		anchor.updateWorldMatrix(true, false);
		point.add(anchor.getWorldPosition(new Vector3()));
		context.self.updateWorldMatrix(true, false);
		context.self.worldToLocal(point);
	}
	if (![point.x, point.y, point.z].every(Number.isFinite)) { throw new Error("Anchor and script transforms must produce a finite position."); }
	var object;
	var resources = new Set();
	if (node.properties.shape === "group") { object = new Group(); }
	else
	{
		var geometry = node.properties.shape === "sphere" ? new SphereGeometry(size / 2, 16, 12) : new BoxGeometry(size, size, size);
		var material = new MeshStandardMaterial({color: node.properties.color});
		resources.add(geometry); resources.add(material);
		object = new Mesh(geometry, material);
	}
	object.name = node.properties.name;
	object.position.copy(point);
	object.updateMatrix();
	return adopt(context, session, node, object, resources);
}

/** Objects whose copies would need engine initialization or duplicate behaviour. */
function copyBlocker(context, source)
{
	if (source === context.self || source.isScene || source.type === "Program") { return "Choose an object, not the scene, program or this script."; }
	if (roots.has(source) || sessions.has(context.self) && source === sessions.get(context.self).container) { return "Copy authored objects; spawned objects share resources with their original."; }
	var reason = null;
	source.traverse(function(object)
	{
		if (reason) { return; }
		if (/Script$/.test(object.type)) { reason = "Objects with scripts cannot be copied at runtime."; }
		else if (object.body || object.type === "Physics") { reason = "Physics objects cannot be copied at runtime."; }
		else if (object.type === "Audio" || object.type === "PositionalAudio") { reason = "Audio emitters cannot be copied at runtime."; }
		else if (object.isCamera) { reason = "Cameras cannot be copied at runtime."; }
	});
	return reason;
}

/**
 * Copy an authored scene object into this script's runtime container. Copies keep the
 * source's world rotation and scale, share its geometry and materials (never disposed
 * here) and are removed on stop like any other spawn.
 */
function spawnCopy(node, source)
{
	var context = isLiveSession(node);
	if (!context) { throw new Error("Copying requires a running visual script in a scene."); }
	if (!liveObject(context, source)) { throw new Error("Source must be a live object in this script's scene."); }
	var blocker = copyBlocker(context, source);
	if (blocker) { throw new Error(blocker); }
	var offset = vectorComponents(node.getInputOrProperty("offset"));
	if (!offset || typeof node.properties.stack !== "boolean") { throw new Error("Use a finite offset and a live limit from 1 to 128."); }
	var session = checkLimit(context, node, node.properties.limit);
	var steps = node.properties.stack ? countOwned(session, node) + 1 : 1;
	source.updateWorldMatrix(true, false);
	context.self.updateWorldMatrix(true, false);
	var world = source.matrixWorld.clone();
	var position = new Vector3().setFromMatrixPosition(world).add(new Vector3().fromArray(offset).multiplyScalar(steps));
	world.setPosition(position);
	var local = new Matrix4().getInverse(context.self.matrixWorld).multiply(world);
	var copy = source.clone(true);
	local.decompose(copy.position, copy.quaternion, copy.scale);
	if (![copy.position.x, copy.position.y, copy.position.z].every(Number.isFinite)) { throw new Error("Source and script transforms must produce a finite position."); }
	copy.name = source.name + " copy";
	copy.traverse(function(object) { object.updateMatrix(); });
	return adopt(context, session, node, copy, new Set());
}

/**
 * Whether the spawn node's object output still carries this object. The cached
 * output value alone is not enough: LGraphNode.serialize (undo history, project
 * save) deletes it while connected links keep the last value.
 */
function outputCarries(node, object)
{
	var output = node.outputs && node.outputs[4];
	if (!output) { return false; }
	if (output._data === object) { return true; }
	var links = node.graph && node.graph.links;
	return Boolean(links && output.links && output.links.some(function(id) { return links[id] && links[id].data === object; }));
}

function destroy(session, object)
{
	var entry = session.objects.get(object);
	session.objects.delete(object);
	owners.delete(object);
	roots.delete(object);
	for (var part of entry.parts) { roots.delete(part); }
	if (object.parent) { object.parent.remove(object); }
	for (var resource of entry.resources) { resource.dispose(); }
	// Invalidate the originating output even when a separate node deletes it.
	if (outputCarries(entry.node, object)) { entry.node.setOutputData(4, null); }
}

function deleteSpawned(node, object)
{
	var context = isLiveSession(node);
	var session = context && sessions.get(context.self);
	if (!session || !session.objects.has(object) || context.scene.getObjectByProperty("uuid", object.uuid) !== object)
	{
		throw new Error("Delete accepts only a live primitive spawned by this visual script.");
	}
	if (attachedChildren(session.objects.get(object), object).length) { throw new Error("Remove attached children before deleting this primitive."); }
	destroy(session, object);
}

/** Objects attached to a spawn after it was created (not part of the spawn itself). */
function attachedChildren(entry, object)
{
	var attached = [];
	(function visit(parent)
	{
		for (var child of parent.children)
		{
			if (entry.parts.has(child)) { visit(child); }
			else { attached.push(child); }
		}
	})(object);
	return attached;
}

/** Capture only materials allocated for this owned object, never shared originals. */
function trackSpawnMaterials(object, materials)
{
	object = roots.get(object) || object;
	var script = owners.get(object);
	var session = script && sessions.get(script);
	var entry = session && session.objects.get(object);
	if (entry) { for (var material of materials) { entry.resources.add(material); } }
}

function releaseSpawns(script, node)
{
	var session = script && sessions.get(script);
	if (!session) { return; }
	for (var object of Array.from(session.objects.keys()))
	{
		if (node && session.objects.get(object).node !== node) { continue; }
		// External code may have attached authored children. Preserve them on stop.
		for (var child of attachedChildren(session.objects.get(object), object)) { script.attach(child); }
		destroy(session, object);
	}
	if (!session.objects.size)
	{
		for (var child of session.container.children.slice()) { script.attach(child); }
		if (session.container.parent) { session.container.parent.remove(session.container); }
		sessions.delete(script);
	}
}

function authoredChildren(script)
{
	var session = sessions.get(script);
	return session ? script.children.filter(function(child) { return child !== session.container; }) : script.children;
}

export {spawnPrimitive, spawnCopy, deleteSpawned, releaseSpawns, authoredChildren, trackSpawnMaterials};
