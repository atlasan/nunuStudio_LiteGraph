import {Group, Mesh, BoxBufferGeometry, SphereBufferGeometry, MeshStandardMaterial, Vector3} from "three";
import {LGraph} from "../../../lib/litegraph.js";
import {scriptContext, vectorComponents} from "./LiteGraphContext.js";

// Runtime ownership never enters userData or saved graph properties.
const sessions = new WeakMap();
const owners = new WeakMap();
const maxObjects = 128;

function isLiveSession(node)
{
	var context = scriptContext(node);
	return context.self && context.scene && context.graph.status === LGraph.STATUS_RUNNING ? context : null;
}

function spawnPrimitive(node)
{
	var context = isLiveSession(node);
	if (!context) { throw new Error("Spawning requires a running visual script in a scene."); }
	var position = vectorComponents(node.getInputOrProperty("position"));
	var size = node.properties.size;
	var limit = node.properties.limit;
	if (!["box", "sphere", "group"].includes(node.properties.shape) || !position || !Number.isFinite(size) || size <= 0 || !Number.isInteger(limit) || limit < 1 || limit > maxObjects || typeof node.properties.name !== "string" || !/^#[0-9a-f]{6}$/i.test(node.properties.color))
	{
		throw new Error("Use a primitive, finite position, positive size, hex color and a limit from 1 to 128.");
	}
	var anchor = node.getInputData(1);
	if (node.isInputConnected(1) && (!anchor || !anchor.isObject3D || context.scene.getObjectByProperty("uuid", anchor.uuid) !== anchor))
	{
		throw new Error("Anchor must be a live object in this script's scene.");
	}
	var session = sessions.get(context.self);
	var count = session ? Array.from(session.objects.values()).filter(function(entry) { return entry.node === node; }).length : 0;
	if (count >= limit || session && session.objects.size >= maxObjects) { throw new Error("Spawn limit reached; delete an owned object before spawning again."); }
	var point = new Vector3().fromArray(position);
	if (node.isInputConnected(1))
	{
		anchor.updateWorldMatrix(true, false);
		point.add(anchor.getWorldPosition(new Vector3()));
		context.self.updateWorldMatrix(true, false);
		context.self.worldToLocal(point);
	}
	if (![point.x, point.y, point.z].every(Number.isFinite)) { throw new Error("Anchor and script transforms must produce a finite position."); }
	if (!session)
	{
		var container = new Group();
		container.name = "Runtime spawns";
		context.self.add(container);
		session = {container: container, objects: new Map()};
		sessions.set(context.self, session);
	}
	var object;
	var resources = new Set();
	if (node.properties.shape === "group") { object = new Group(); }
	else
	{
		var geometry = node.properties.shape === "sphere" ? new SphereBufferGeometry(size / 2, 16, 12) : new BoxBufferGeometry(size, size, size);
		var material = new MeshStandardMaterial({color: node.properties.color});
		resources.add(geometry); resources.add(material);
		object = new Mesh(geometry, material);
	}
	object.name = node.properties.name;
	object.position.copy(point);
	object.updateMatrix();
	session.objects.set(object, {node: node, resources: resources});
	owners.set(object, context.self);
	session.container.add(object);
	return object;
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
	if (object.children.length) { throw new Error("Remove attached children before deleting this primitive."); }
	destroy(session, object);
}

/** Capture only materials allocated for this owned object, never shared originals. */
function trackSpawnMaterials(object, materials)
{
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
		for (var child of object.children.slice()) { script.attach(child); }
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

export {spawnPrimitive, deleteSpawned, releaseSpawns, authoredChildren, trackSpawnMaterials};
