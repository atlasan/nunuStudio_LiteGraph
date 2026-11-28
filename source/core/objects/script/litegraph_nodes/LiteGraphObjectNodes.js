/* eslint-disable camelcase -- LiteGraph node API. */
import {Vector3, Quaternion, Color} from "three";
import {LiteGraph} from "../../../../lib/litegraph/litegraph.mini.js";
import {registerNunuNode} from "../LiteGraphNodeCatalog.js";
import {scriptContext, vectorComponents, updateObjectMatrix} from "../LiteGraphContext.js";

import {trackSpawnMaterials} from "../LiteGraphSpawnContext.js";

function validObject(node, value)
{
	var scene = scriptContext(node).scene;
	return Boolean(scene && value && value.isObject3D && scene.getObjectByProperty("uuid", value.uuid) === value);
}

function actionPorts(node, type)
{
	node.mode = LiteGraph.ON_EVENT;
	node.addInput("apply", LiteGraph.ACTION);
	node.addInput("object", type || "nunu_object,object");
	node.addOutput("done", LiteGraph.EVENT);
	node.addOutput("failed", LiteGraph.EVENT);
	node.addOutput("success", "boolean");
	node.addOutput("message", "string");
}

function result(node, success, message, object, options)
{
	node.setOutputData(2, success);
	node.setOutputData(3, message);
	node.operationError = success ? null : message;
	node.triggerSlot(success ? 0 : 1, success ? object : message, null, options);
}

function colorValue(value)
{
	if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) { return new Color(value); }
	if (value && value.isColor) { value = [value.r, value.g, value.b]; }
	var components = vectorComponents(value);
	return components && components.every(function(component) { return component >= 0 && component <= 1; }) ? new Color().fromArray(components) : null;
}

class FindObject
{
	constructor()
	{
		this.properties = {name: "Spinning box"};
		this.addInput("root", "nunu_object,object");
		this.addOutput("object", "nunu_object");
		this.addOutput("found", "boolean");
		this.addOutput("matches", "array");
		this.addWidget("text", "exact name", this.properties.name, null, {property: "name"});
	}

	onExecute()
	{
		var root = this.isInputConnected(0) ? this.getInputData(0) : scriptContext(this).scene;
		var matches = [];
		var name = this.properties.name;
		if (validObject(this, root)) { root.traverse(function(object) { if (object.name === name) { matches.push(object); } }); }
		this.setOutputData(0, matches[0] || null);
		this.setOutputData(1, matches.length > 0);
		this.setOutputData(2, matches);
	}
}
FindObject.title = "Find Object";
FindObject.desc = "Find exact names under a root (default: current scene). First match and all matches; UUID bindings are more stable.";

class ObjectInfo
{
	constructor()
	{
		this.addInput("object", "nunu_object,object");
		for (var port of [["name", "string"], ["type", "string"], ["uuid", "string"], ["parent", "nunu_object"], ["children", "array"], ["visible", "boolean"]]) { this.addOutput(port[0], port[1]); }
	}

	onExecute()
	{
		var object = this.getInputData(0);
		if (!validObject(this, object)) { object = null; }
		var values = object ? [object.name, object.type, object.uuid, object.parent, object.children.slice(), object.visible] : ["", "", "", null, [], false];
		for (var index = 0; index < values.length; index++) { this.setOutputData(index, values[index]); }
	}
}
ObjectInfo.title = "Object Info";
ObjectInfo.desc = "Read identity and hierarchy of an object in this scene. Children is a copied list; hierarchy is not changed.";

class WorldTransform
{
	constructor()
	{
		this.addInput("object", "nunu_object,object");
		for (var port of [["position", "vec3"], ["quaternion", "vec4"], ["scale", "vec3"], ["forward", "vec3"]]) { this.addOutput(port[0], port[1]); }
	}

	onExecute()
	{
		var object = this.getInputData(0);
		if (!validObject(this, object))
		{
			for (var index = 0; index < 4; index++) { this.setOutputData(index, null); }
			return;
		}
		object.updateWorldMatrix(true, false);
		this.setOutputData(0, object.getWorldPosition(new Vector3()).toArray());
		this.setOutputData(1, object.getWorldQuaternion(new Quaternion()).toArray());
		this.setOutputData(2, object.getWorldScale(new Vector3()).toArray());
		this.setOutputData(3, object.getWorldDirection(new Vector3()).toArray());
	}
}
WorldTransform.title = "World Transform";
WorldTransform.desc = "Read parent-aware world position, quaternion, scale and forward direction (camera looks along -Z).";

class LookAt
{
	constructor()
	{
		actionPorts(this);
		this.properties = {target: [0, 0, 0]};
		this.addInput("target", "vec3");
		var self = this;
		for (var index = 0; index < 3; index++)
		{
			(function(axis)
			{
				self.addWidget("number", "target " + ["X", "Y", "Z"][axis], 0, function(value)
				{
					var target = self.properties.target.slice();
					target[axis] = value;
					self.setProperty("target", target);
				}, {precision: 2, step: 0.1});
			})(index);
		}
	}

	onPropertyChanged(name, value)
	{
		if (name === "target" && value && value.length === 3)
		{
			for (var index = 0; index < 3; index++) { this.widgets[index].value = value[index]; }
		}
	}

	onAction(action, param, options)
	{
		var object = this.getInputData(1);
		var target = vectorComponents(this.getInputOrProperty("target"));
		if (!validObject(this, object) || !target) { result(this, false, "Choose a scene object and a finite world target.", null, options); return; }
		object.updateWorldMatrix(true, false);
		var point = new Vector3().fromArray(target);
		if (object.getWorldPosition(new Vector3()).distanceToSquared(point) < 1e-12) { result(this, false, "Target must differ from the object's world position.", null, options); return; }
		if (object.parent)
		{
			var scale = object.parent.getWorldScale(new Vector3());
			if (scale.x <= 0 || scale.y <= 0 || scale.z <= 0 || Math.abs(scale.x - scale.y) > 1e-6 || Math.abs(scale.y - scale.z) > 1e-6) { result(this, false, "Look At requires positive uniform parent scale.", null, options); return; }
		}
		object.lookAt(point);
		updateObjectMatrix(object);
		result(this, true, "", object, options);
	}
}
LookAt.title = "Look At";
LookAt.desc = "Face a world-space target. Uses Three.js camera/object forward conventions; non-uniformly scaled parents are not supported.";

class Visibility
{
	constructor()
	{
		actionPorts(this);
		this.properties = {operation: "toggle", visible: true};
		this.addInput("visible", "boolean");
		this.addWidget("combo", "operation", "toggle", null, {property: "operation", values: ["toggle", "set"]});
		this.addWidget("toggle", "visible", true, null, {property: "visible"});
	}

	onAction(action, param, options)
	{
		var object = this.getInputData(1);
		var value = this.getInputOrProperty("visible");
		if (!validObject(this, object) || !["toggle", "set"].includes(this.properties.operation) || this.properties.operation === "set" && typeof value !== "boolean") { result(this, false, "Choose a scene object and a valid visibility operation.", null, options); return; }
		object.visible = this.properties.operation === "toggle" ? !object.visible : value;
		result(this, true, "", object, options);
	}
}
Visibility.title = "Visibility";
Visibility.desc = "Toggle visibility, or set it from the boolean input/widget. Hidden objects remain in the hierarchy and scripts still run.";

function validKey(key)
{
	return typeof key === "string" && key.trim().length > 0 && !["__proto__", "constructor", "prototype"].includes(key);
}

class GetData
{
	constructor()
	{
		this.properties = {key: "health", fallback: 0};
		this.addInput("object", "nunu_object,object");
		this.addOutput("value", 0);
		this.addOutput("found", "boolean");
		this.addWidget("text", "key", "health", null, {property: "key"});
	}

	onExecute()
	{
		var object = this.getInputData(0);
		var key = this.properties.key;
		var found = validObject(this, object) && validKey(key) && object.userData && Object.prototype.hasOwnProperty.call(object.userData, key);
		this.setOutputData(0, found ? object.userData[key] : this.properties.fallback);
		this.setOutputData(1, Boolean(found));
	}
}
GetData.title = "Get Object Data";
GetData.desc = "Read an own userData field without invoking inherited properties; fallback defaults to zero.";

class SetData
{
	constructor()
	{
		actionPorts(this);
		this.properties = {key: "health", value: 100};
		this.addInput("value", 0);
		this.addWidget("text", "key", "health", null, {property: "key"});
		this.addWidget("number", "value", 100, null, {property: "value", step: 1});
	}

	onAction(action, param, options)
	{
		var object = this.getInputData(1);
		var value = this.getInputOrProperty("value");
		var scalar = value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value);
		if (!validObject(this, object) || !validKey(this.properties.key) || !scalar || !object.userData || typeof object.userData !== "object" || Array.isArray(object.userData)) { result(this, false, "Use a scene object, a safe data key and a JSON scalar value.", null, options); return; }
		object.userData[this.properties.key] = value;
		result(this, true, "", object, options);
	}
}
SetData.title = "Set Object Data";
SetData.desc = "Set a userData field to a JSON scalar (finite number, string, boolean or null). This is not arbitrary object-property reflection.";

class Projection
{
	constructor()
	{
		actionPorts(this);
		this.properties = {fov: 50, near: 0.1, far: 100};
		for (var name of ["fov", "near", "far"])
		{
			this.addInput(name, "number");
			this.addWidget("number", name, this.properties[name], null, {property: name, precision: 2, step: 1});
		}
	}

	onAction(action, param, options)
	{
		var object = this.getInputData(1);
		var fov = this.getInputOrProperty("fov"), near = this.getInputOrProperty("near"), far = this.getInputOrProperty("far");
		if (!validObject(this, object) || !(object.isPerspectiveCamera || object.isOrthographicCamera) || !Number.isFinite(near) || !Number.isFinite(far) || near < 0 || far <= near || object.isPerspectiveCamera && (near === 0 || !Number.isFinite(fov) || fov <= 0 || fov >= 180) || object.isOrthographicCamera && this.isInputConnected(2)) { result(this, false, "Use a camera, valid clipping planes and a perspective FOV between 0 and 180 degrees.", null, options); return; }
		if (object.isPerspectiveCamera) { object.fov = fov; }
		object.near = near;
		object.far = far;
		object.updateProjectionMatrix();
		result(this, true, "", object, options);
	}
}
Projection.title = "Camera Projection";
Projection.desc = "Set perspective FOV (degrees) and clipping planes. Orthographic cameras accept clipping only; projection matrices update atomically.";

class LightSettings
{
	constructor()
	{
		actionPorts(this);
		this.properties = {intensity: 2, color: "#ffffff"};
		this.addInput("intensity", "number");
		this.addInput("color", "color,vec3,string");
		this.addWidget("number", "intensity", 2, null, {property: "intensity", precision: 2, step: 0.1});
		this.addWidget("text", "hex color", "#ffffff", null, {property: "color"});
	}

	onAction(action, param, options)
	{
		var object = this.getInputData(1);
		var intensity = this.getInputOrProperty("intensity");
		var color = colorValue(this.getInputOrProperty("color"));
		if (!validObject(this, object) || !object.isLight || !object.color || !Number.isFinite(intensity) || intensity < 0 || !color) { result(this, false, "Use a scene light, non-negative intensity and a valid color.", null, options); return; }
		object.intensity = intensity;
		object.color.copy(color);
		result(this, true, "", object, options);
	}
}
LightSettings.title = "Light Settings";
LightSettings.desc = "Set a light's finite non-negative intensity and color (#RRGGBB or normalized RGB). Does not alter shadow configuration.";

const ownedMaterials = new WeakMap();
class MaterialColor
{
	constructor()
	{
		actionPorts(this);
		this.properties = {color: "#55dd88", shared: false};
		this.addInput("color", "color,vec3,string");
		this.addWidget("text", "hex color", this.properties.color, null, {property: "color"});
		this.addWidget("toggle", "affect shared material", false, null, {property: "shared"});
	}

	onAction(action, param, options)
	{
		var object = this.getInputData(1);
		var color = colorValue(this.getInputOrProperty("color"));
		var materials = object && object.material ? Array.isArray(object.material) ? object.material : [object.material] : [];
		if (!validObject(this, object) || !object.isMesh || !color || !materials.length || materials.some(function(material) { return !material || !material.color || typeof material.clone !== "function"; })) { result(this, false, "Use a mesh with color-capable materials and a valid color.", null, options); return; }
		if (!this.properties.shared && ownedMaterials.get(object) !== object.material)
		{
			var copies = materials.map(function(material) { return material.clone(); });
			object.material = Array.isArray(object.material) ? copies : copies[0];
			ownedMaterials.set(object, object.material);
			trackSpawnMaterials(object, copies);
			materials = copies;
		}
		for (var material of materials) { material.color.copy(color); }
		result(this, true, "", object, options);
	}
}
MaterialColor.title = "Mesh Color";
MaterialColor.desc = "Tint a mesh's color-capable materials. By default clone once per object; opt in to modifying shared materials.";

const definitions = [
	["nunu/objects/find", FindObject, "Scene", "Object3D", "read"],
	["nunu/objects/info", ObjectInfo, "Scene", "Object3D", "read"],
	["nunu/objects/world_transform", WorldTransform, "Transforms", "Object3D", "read"],
	["nunu/objects/look_at", LookAt, "Transforms", "Object3D", "write"],
	["nunu/objects/visibility", Visibility, "Scene", "Object3D", "write"],
	["nunu/data/get", GetData, "Data", "Object3D", "read"],
	["nunu/data/set", SetData, "Data", "Object3D", "write"],
	["nunu/camera/projection", Projection, "Camera", "Camera", "write"],
	["nunu/lights/settings", LightSettings, "Light", "Light", "write"],
	["nunu/materials/color", MaterialColor, "Material", "Mesh", "write"]
];
for (var definition of definitions)
{
	definition[1].size = definition[4] === "write" ? [280, 240] : [220, 160];
	registerNunuNode(definition[0], definition[1], {category: definition[2], accepts: definition[3], effect: definition[4]});
}

export {validObject, actionPorts, result};
