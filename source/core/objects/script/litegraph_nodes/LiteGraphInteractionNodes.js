/* eslint-disable camelcase -- LiteGraph node API. */
import {Vector3} from "three";
import {LiteGraph} from "../../../../lib/litegraph/litegraph.mini.js";
import {registerNunuNode} from "../LiteGraphNodeCatalog.js";
import {scriptContext, vectorComponents, firstInputFrame} from "../LiteGraphContext.js";
import {validObject, actionPorts, result} from "./LiteGraphObjectNodes.js";

function visibleInScene(object)
{
	for (var node = object; node; node = node.parent)
	{
		if (!node.visible) { return false; }
	}
	return true;
}

function isWithin(object, root)
{
	for (var node = object; node; node = node.parent)
	{
		if (node === root) { return true; }
	}
	return false;
}

/**
 * Report a boolean state change as entered/exited events. Used by pointer hover and
 * proximity so both fire once per transition, never every frame.
 */
function transition(node, state, enteredSlot, exitedSlot, value)
{
	if (state !== node._inside)
	{
		node._inside = state;
		node.triggerSlot(state ? enteredSlot : exitedSlot, value);
	}
}

class Pointer
{
	constructor()
	{
		this.properties = {button: 0};
		this.addInput("object", "nunu_object,object");
		this.addOutput("hovering", "boolean");
		this.addOutput("point", "vec3");
		this.addOutput("distance", "number");
		this.addOutput("entered", LiteGraph.EVENT);
		this.addOutput("exited", LiteGraph.EVENT);
		this.addOutput("clicked", LiteGraph.EVENT);
		this.addWidget("number", "button", 0, null, {property: "button", precision: 0, step: 1, min: 0, max: 4});
		this._inside = false;
	}

	onConfigure() { this._inside = false; }

	onExecute()
	{
		var context = scriptContext(this);
		var object = this.getInputData(0);
		var mouse = context.program ? context.program.mouse : null;
		var hit = null;
		if (validObject(this, object) && context.scene.raycaster && (!mouse || typeof mouse.insideCanvas !== "function" || mouse.insideCanvas()))
		{
			// The scene refreshes its raycaster from the active camera before scripts update.
			var hits = context.scene.raycaster.intersectObjects(context.scene.children, true);
			for (var candidate of hits)
			{
				if (visibleInScene(candidate.object))
				{
					hit = isWithin(candidate.object, object) ? candidate : null;
					break;
				}
			}
		}
		this.setOutputData(0, hit !== null);
		this.setOutputData(1, hit ? [hit.point.x, hit.point.y, hit.point.z] : null);
		this.setOutputData(2, hit ? hit.distance : null);
		transition(this, hit !== null, 3, 4, object);
		var button = Number(this.properties.button);
		if (hit && mouse && Number.isInteger(button) && button >= 0 && button < 5 &&
			mouse.buttonJustPressed(button) && firstInputFrame(this, context.program)) { this.triggerSlot(5, object); }
	}
}
Pointer.title = "Pointer";
Pointer.desc = "Hover and click on an object (or any of its children) with the mouse, through the scene's active camera. Objects in front block the pointer; hidden objects are ignored. Point is the world-space hit.";
Pointer.size = [240, 170];

class Proximity
{
	constructor()
	{
		this.properties = {radius: 2};
		this.addInput("a", "nunu_object,object");
		this.addInput("b", "nunu_object,object");
		this.addInput("radius", "number");
		this.addOutput("distance", "number");
		this.addOutput("inside", "boolean");
		this.addOutput("entered", LiteGraph.EVENT);
		this.addOutput("exited", LiteGraph.EVENT);
		this.addWidget("number", "radius", 2, null, {property: "radius", precision: 2, step: 0.1, min: 0});
		this._inside = false;
	}

	onConfigure() { this._inside = false; }

	onExecute()
	{
		var a = this.getInputData(0), b = this.getInputData(1);
		var radius = Number(this.getInputOrProperty("radius"));
		var distance = null;
		if (validObject(this, a) && validObject(this, b))
		{
			a.updateWorldMatrix(true, false);
			b.updateWorldMatrix(true, false);
			distance = a.getWorldPosition(new Vector3()).distanceTo(b.getWorldPosition(new Vector3()));
		}
		var inside = distance !== null && Number.isFinite(radius) && radius >= 0 && distance <= radius;
		this.setOutputData(0, distance);
		this.setOutputData(1, inside);
		transition(this, inside, 2, 3, distance);
	}
}
Proximity.title = "Proximity";
Proximity.desc = "World-space distance between two objects. Entered/exited fire once when the distance crosses the radius; a missing object counts as outside.";
Proximity.size = [240, 130];

var physicsOperations = ["apply impulse", "set velocity", "add velocity"];

class PhysicsBody
{
	constructor()
	{
		actionPorts(this);
		this.addInput("vector", "vec3");
		this.properties = {operation: "apply impulse", vector: [0, 5, 0]};
		this.addWidget("combo", "operation", "apply impulse", null, {property: "operation", values: physicsOperations});
		var self = this;
		this.vectorWidgets = [0, 1, 2].map(function(axis)
		{
			return self.addWidget("number", "vector " + ["X", "Y", "Z"][axis], self.properties.vector[axis], function(value)
			{
				var vector = self.properties.vector.slice(); vector[axis] = value;
				self.setProperty("vector", vector);
			}, {precision: 2, step: 0.1});
		});
	}

	onPropertyChanged(name, value)
	{
		if (name === "vector" && value && value.length === 3)
		{
			for (var index = 0; index < 3; index++) { this.vectorWidgets[index].value = value[index]; }
		}
	}

	onAction(action, param, options)
	{
		var object = this.getInputData(1);
		var vector = vectorComponents(this.getInputOrProperty("vector"));
		var operation = this.properties.operation;
		var body = object ? object.body : null;
		if (!validObject(this, object) || !body || !body.velocity) { result(this, false, "Choose a physics object in this scene.", null, options); return; }
		if (!object.world) { result(this, false, "Physics is not running for this object; enable physics on the scene and Run.", null, options); return; }
		if (!(body.mass > 0) || body.type !== 1) { result(this, false, "Only dynamic bodies with mass can be driven.", null, options); return; }
		if (!vector || !physicsOperations.includes(operation)) { result(this, false, "Choose an operation and a finite vector.", null, options); return; }
		var velocity = body.velocity;
		if (operation === "set velocity") { velocity.set(vector[0], vector[1], vector[2]); }
		else
		{
			// An impulse through the center changes only linear velocity: Δv = J / m.
			var scale = operation === "apply impulse" ? 1 / body.mass : 1;
			velocity.set(velocity.x + vector[0] * scale, velocity.y + vector[1] * scale, velocity.z + vector[2] * scale);
		}
		if (typeof body.wakeUp === "function") { body.wakeUp(); }
		result(this, true, "", object, options);
	}
}
PhysicsBody.title = "Physics Body";
PhysicsBody.desc = "Drive a dynamic physics object's body: apply an impulse at its center (N·s, divided by mass), set or add linear velocity (m/s). Needs scene physics running; static and kinematic bodies are rejected.";
PhysicsBody.size = [280, 250];

// Physics bodies map back to their scene objects; verified on every use.
var bodyOwners = new WeakMap();

function bodyObject(scene, body)
{
	var object = bodyOwners.get(body);
	if (object && object.body === body && scene.getObjectByProperty("uuid", object.uuid) === object) { return object; }
	object = null;
	scene.traverse(function(child)
	{
		if (child.body) { bodyOwners.set(child.body, child); }
		if (child.body === body) { object = child; }
	});
	return object;
}

class Collision
{
	constructor()
	{
		this.addInput("object", "nunu_object,object");
		this.addInput("other", "nunu_object,object");
		this.addOutput("touching", "boolean");
		this.addOutput("other", "nunu_object");
		this.addOutput("impact", "number");
		this.addOutput("began", LiteGraph.EVENT);
		this.addOutput("ended", LiteGraph.EVENT);
		this._contacts = new Map();
	}

	onConfigure() { this._contacts = new Map(); }

	onExecute()
	{
		var context = scriptContext(this);
		var object = this.getInputData(0);
		var filtered = this.isInputConnected(1);
		var filter = filtered ? this.getInputData(1) : null;
		var current = new Map();
		// A connected but missing filter object watches nothing.
		if (validObject(this, object) && object.body && object.world && object.world.contacts && (!filtered || validObject(this, filter) && filter.body))
		{
			var body = object.body;
			for (var contact of object.world.contacts)
			{
				var other = contact.bi === body ? contact.bj : contact.bj === body ? contact.bi : null;
				if (!other || filtered && filter.body !== other) { continue; }
				var impact = typeof contact.getImpactVelocityAlongNormal === "function" ? Math.abs(contact.getImpactVelocityAlongNormal()) : 0;
				current.set(other, Math.max(current.get(other) || 0, impact));
			}
		}
		var began = [];
		for (var entry of current) { if (!this._contacts.has(entry[0])) { began.push(entry); } }
		var ended = Array.from(this._contacts.keys()).filter(function(other) { return !current.has(other); });
		this._contacts = current;
		this.setOutputData(0, current.size > 0);
		for (var start of began)
		{
			var startObject = context.scene ? bodyObject(context.scene, start[0]) : null;
			this.setOutputData(1, startObject);
			this.setOutputData(2, start[1]);
			this.triggerSlot(3, startObject);
		}
		for (var end of ended) { this.triggerSlot(4, context.scene ? bodyObject(context.scene, end) : null); }
	}
}
Collision.title = "Collision";
Collision.desc = "Contacts of a physics object from the last physics step. Began/ended fire once per touching body; other is the last body that began touching; impact is its approach speed (m/s). Connect other to only watch one object.";
Collision.size = [240, 150];

var authoredEnabled = new WeakMap();
var animationOperations = ["play", "pause", "toggle", "stop", "restart", "set speed"];

class AnimationPlayback
{
	constructor()
	{
		actionPorts(this);
		this.properties = {operation: "toggle", clip: "", speed: 1};
		this.addInput("speed", "number");
		this.addOutput("playing", "boolean");
		this.addOutput("time", "number");
		this.addWidget("combo", "operation", "toggle", null, {property: "operation", values: animationOperations});
		this.addWidget("text", "clip (empty = all)", "", null, {property: "clip"});
		this.addWidget("number", "speed", 1, null, {property: "speed", precision: 2, step: 0.1});
	}

	onAction(action, param, options)
	{
		var object = this.getInputData(1);
		var operation = this.properties.operation;
		var clip = this.properties.clip;
		var mixer = object ? object.mixer : null;
		var actions = mixer && Array.isArray(mixer._actions) ? mixer._actions : [];
		if (!validObject(this, object) || !actions.length) { result(this, false, "Choose an object with animation clips in a running scene.", null, options); return; }
		if (!animationOperations.includes(operation) || typeof clip !== "string") { result(this, false, "Choose a playback operation.", null, options); return; }
		var targets = clip ? actions.filter(function(item) { return item.getClip().name === clip; }) : actions;
		if (!targets.length) { result(this, false, "No animation clip named \"" + clip + "\" on this object.", null, options); return; }
		if (operation === "set speed")
		{
			var speed = Number(this.getInputOrProperty("speed"));
			if (!Number.isFinite(speed)) { result(this, false, "Speed must be a finite number.", null, options); return; }
			for (var target of targets) { target.timeScale = speed; }
		}
		else
		{
			if (operation === "toggle") { operation = mixer.playing ? "pause" : "play"; }
			if (operation === "play" || operation === "restart")
			{
				// A named clip plays alone; all clips restores each clip's authored enabled state.
				for (var item of actions)
				{
					if (!authoredEnabled.has(item)) { authoredEnabled.set(item, item.enabled); }
					item.enabled = clip ? targets.includes(item) : authoredEnabled.get(item);
				}
			}
			if (operation === "play") { mixer.play(); }
			else if (operation === "pause") { mixer.pause(); }
			else if (operation === "stop") { mixer.stop(); }
			else
			{
				mixer.setTime(0);
				mixer.play();
			}
		}
		this.setOutputData(4, Boolean(mixer.playing));
		this.setOutputData(5, mixer.time);
		result(this, true, "", object, options);
	}
}
AnimationPlayback.title = "Animation Playback";
AnimationPlayback.desc = "Control an object's animation clips while running: play, pause, toggle, stop (rewinds), restart, or set speed (negative plays backwards). With a clip name, play and restart run only that clip and speed applies only to it.";
AnimationPlayback.size = [280, 230];

var audioOperations = ["play", "restart", "pause", "stop", "toggle"];

class AudioPlayback
{
	constructor()
	{
		actionPorts(this);
		this.properties = {operation: "play"};
		this.addOutput("playing", "boolean");
		this.addWidget("combo", "operation", "play", null, {property: "operation", values: audioOperations});
	}

	onAction(action, param, options)
	{
		var object = this.getInputData(1);
		var operation = this.properties.operation;
		if (!validObject(this, object) || object.type !== "Audio" && object.type !== "PositionalAudio" || typeof object.play !== "function") { result(this, false, "Choose an audio emitter in this scene.", null, options); return; }
		if (!audioOperations.includes(operation)) { result(this, false, "Choose a playback operation.", null, options); return; }
		if (operation === "toggle") { operation = object.isPlaying ? "pause" : "play"; }
		if ((operation === "play" || operation === "restart") && !object.buffer) { result(this, false, "Audio is still loading; try again once it is ready.", null, options); return; }
		if (operation === "restart" || operation === "play" && !object.isPlaying)
		{
			if (object.isPlaying) { object.stop(); }
			object.play();
		}
		else if (operation === "pause" && object.isPlaying) { object.pause(); }
		// Never-played emitters have no source; stop also rewinds a paused sound.
		else if (operation === "stop" && object.source) { object.stop(); }
		this.setOutputData(4, Boolean(object.isPlaying));
		result(this, true, "", object, options);
	}
}
AudioPlayback.title = "Audio Playback";
AudioPlayback.desc = "Play, restart, pause, stop or toggle an audio emitter. Play resumes a paused sound and leaves a playing one running; audio must have finished loading.";
AudioPlayback.size = [260, 150];

registerNunuNode("nunu/input/pointer", Pointer, {category: "Input", accepts: "Object3D", effect: "read"});
registerNunuNode("nunu/objects/proximity", Proximity, {category: "Scene", accepts: "Object3D", effect: "read"});
registerNunuNode("nunu/physics/body", PhysicsBody, {category: "Physics", accepts: "Physics", effect: "write"});
registerNunuNode("nunu/physics/collision", Collision, {category: "Physics", accepts: "Physics", effect: "read"});
registerNunuNode("nunu/animation/playback", AnimationPlayback, {category: "Animation", accepts: "Animated", effect: "write"});
registerNunuNode("nunu/audio/playback", AudioPlayback, {category: "Audio", accepts: "Audio", effect: "write"});
