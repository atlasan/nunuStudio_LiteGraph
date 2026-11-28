/* eslint-disable camelcase -- LiteGraph and persisted node APIs. */
import {LiteGraph} from "../../../../lib/litegraph/litegraph.mini.js";
import {registerNunuNode} from "../LiteGraphNodeCatalog.js";
import {scriptContext, vectorComponents, updateObjectMatrix, firstInputFrame} from "../LiteGraphContext.js";

class NunuContext
{
	constructor()
	{
		this.addOutput("self", "nunu_object");
		this.addOutput("parent", "nunu_object");
		this.addOutput("scene", "nunu_object");
		this.addOutput("program", "object");
	}

	onExecute()
	{
		var context = scriptContext(this);
		this.setOutputData(0, context.self);
		this.setOutputData(1, context.parent);
		this.setOutputData(2, context.scene);
		this.setOutputData(3, context.program);
	}
}
NunuContext.title = "Script Context";
NunuContext.desc = "Objects belonging to this running script, never the editor preview.";

class NunuEvents
{
	constructor()
	{
		this.addOutput("started", LiteGraph.EVENT);
		this.addOutput("update", LiteGraph.EVENT);
		this.addOutput("stopped", LiteGraph.EVENT);
		this.addOutput("resized", LiteGraph.EVENT);
		this.addOutput("app data", LiteGraph.EVENT);
		this.addOutput("delta", "number");
		this.addOutput("time", "number");
		this.addOutput("size", "vec2");
		this.addOutput("data", 0);
	}

	publishTime()
	{
		this.setOutputData(5, this.graph.elapsed_time);
		this.setOutputData(6, this.graph.globaltime);
	}

	onStart()
	{
		this.publishTime();
		this.triggerSlot(0);
	}

	onExecute()
	{
		this.publishTime();
		this.triggerSlot(1, this.graph.elapsed_time);
	}

	onStop()
	{
		this.triggerSlot(2);
	}

	onResize(width, height)
	{
		this.setOutputData(7, [width, height]);
		this.triggerSlot(3, [width, height]);
	}

	onAppData(data)
	{
		this.setOutputData(8, data);
		this.triggerSlot(4, data);
	}
}
NunuEvents.title = "Scene Events";
NunuEvents.desc = "Engine lifecycle. Update fires once per frame; delta and time are seconds.";

class NunuKeyboard
{
	constructor()
	{
		this.properties = {key: 32};
		this.addWidget("number", "key code", 32, null, {property: "key", precision: 0, step: 1, min: 0, max: 255});
		this.addOutput("down", "boolean");
		this.addOutput("pressed", LiteGraph.EVENT);
		this.addOutput("released", LiteGraph.EVENT);
	}

	samplePreviewInput(program)
	{
		const key = Number(this.properties.key);
		this.setOutputData(0, Boolean(program.keyboard && program.keyboard.keyPressed(key)));
	}

	onExecute()
	{
		var program = scriptContext(this).program;
		var keyboard = program ? program.keyboard : null;
		var key = Number(this.properties.key);
		var valid = Number.isInteger(key) && key >= 0 && key <= 255;
		if (!firstInputFrame(this, program)) {return;}
		if (valid && keyboard && keyboard.keyJustPressed(key)) { this.triggerSlot(1, key); }
		if (valid && keyboard && keyboard.keyJustReleased(key)) { this.triggerSlot(2, key); }
	}
}
NunuKeyboard.title = "Keyboard";
NunuKeyboard.desc = "Read nunuStudio's frame-synchronized input. 32 = Space, 65 = A, 87 = W.";

class NunuMouse
{
	constructor()
	{
		this.properties = {button: 0};
		this.addWidget("number", "button", 0, null, {property: "button", precision: 0, step: 1, min: 0, max: 4});
		this.addOutput("position", "vec2");
		this.addOutput("delta", "vec2");
		this.addOutput("wheel", "number");
		this.addOutput("down", "boolean");
		this.addOutput("pressed", LiteGraph.EVENT);
		this.addOutput("released", LiteGraph.EVENT);
	}

	samplePreviewInput(program)
	{
		var mouse = program.mouse;
		var button = Number(this.properties.button);
		var valid = Number.isInteger(button) && button >= 0 && button < 5;
		this.setOutputData(0, mouse ? [mouse.position.x, mouse.position.y] : [0, 0]);
		this.setOutputData(1, mouse ? [mouse.delta.x, mouse.delta.y] : [0, 0]);
		this.setOutputData(2, mouse ? mouse.wheel : 0);
		this.setOutputData(3, Boolean(valid && mouse && mouse.buttonPressed(button)));
	}

	onExecute()
	{
		const {program} = scriptContext(this);
		const mouse = program ? program.mouse : null;
		const button = Number(this.properties.button);
		const valid = Number.isInteger(button) && button >= 0 && button < 5;
		if (!firstInputFrame(this, program)) {return;}
		if (valid && mouse && mouse.buttonJustPressed(button)) { this.triggerSlot(4, button); }
		if (valid && mouse && mouse.buttonJustReleased(button)) { this.triggerSlot(5, button); }
	}
}
NunuMouse.title = "Mouse";
NunuMouse.desc = "Read the running program's mouse; position and movement use canvas pixels.";

class NunuGetTransform
{
	constructor()
	{
		this.addInput("object", "nunu_object,object");
		this.addOutput("position", "vec3");
		this.addOutput("rotation", "vec3");
		this.addOutput("scale", "vec3");
		this.addOutput("visible", "boolean");
	}

	onExecute()
	{
		var object = this.getInputData(0);
		for (var i = 0; i < 3; i++)
		{
			var value = object ? object[["position", "rotation", "scale"][i]] : null;
			this.setOutputData(i, value ? [value.x, value.y, value.z] : null);
		}
		this.setOutputData(3, object ? object.visible : false);
	}
}
NunuGetTransform.title = "Get Transform";
NunuGetTransform.desc = "Read local position, Euler rotation in radians, scale and visibility.";

class NunuSetTransform
{
	constructor()
	{
		this.mode = LiteGraph.ON_EVENT;
		this.addInput("apply", LiteGraph.ACTION);
		this.addInput("object", "nunu_object,object");
		this.addInput("position", "vec3");
		this.addInput("rotation", "vec3");
		this.addInput("scale", "vec3");
		this.addInput("visible", "boolean");
		this.addOutput("done", LiteGraph.EVENT);
	}

	onAction(action, param, options)
	{
		var object = this.getInputData(1);
		if (!object || !object.isObject3D) { return; }
		for (var i = 0; i < 3; i++)
		{
			if (!this.isInputConnected(i + 2)) { continue; }
			var value = vectorComponents(this.getInputData(i + 2));
			if (value) { object[["position", "rotation", "scale"][i]].set(value[0], value[1], value[2]); }
		}
		if (this.isInputConnected(5) && typeof this.getInputData(5) === "boolean") { object.visible = this.getInputData(5); }
		updateObjectMatrix(object);
		this.triggerSlot(0, object, null, options);
	}
}
NunuSetTransform.title = "Set Transform";
NunuSetTransform.desc = "On apply, set connected local transform values. Rotation is radians; unconnected fields stay unchanged.";

function motionNode(rotation)
{
	class Motion
	{
		constructor()
		{
			this.mode = LiteGraph.ON_EVENT;
			this.properties = {velocity: rotation ? [0, 1, 0] : [1, 0, 0]};
			this.addInput("apply", LiteGraph.ACTION);
			this.addInput("object", "nunu_object,object");
			this.addInput("velocity", "vec3");
			this.addInput("delta", "number");
			this.addOutput("done", LiteGraph.EVENT);
			var self = this;
			for (var index = 0; index < 3; index++)
			{
				(function(axis)
				{
					self.addWidget("number", ["X", "Y", "Z"][axis] + (rotation ? " rad/s" : " units/s"), self.properties.velocity[axis], function(value)
					{
						var velocity = self.properties.velocity.slice();
						velocity[axis] = value;
						self.setProperty("velocity", velocity);
					}, {precision: 2, step: 0.1});
				})(index);
			}
		}

		onPropertyChanged(name, value)
		{
			if (name === "velocity" && value && value.length === 3)
			{
				for (var index = 0; index < 3; index++) { this.widgets[index].value = value[index]; }
			}
		}

		onConfigure() { this.onPropertyChanged("velocity", this.properties.velocity); }

		onAction(action, param, options)
		{
			var object = this.getInputData(1);
			var velocity = vectorComponents(this.getInputOrProperty("velocity"));
			var delta = this.isInputConnected(3) ? this.getInputData(3) : this.graph.elapsed_time;
			if (!object || !object.isObject3D || !velocity || !Number.isFinite(delta) || delta < 0) { return; }
			var target = rotation ? object.rotation : object.position;
			target.set(target.x + velocity[0] * delta, target.y + velocity[1] * delta, target.z + velocity[2] * delta);
			updateObjectMatrix(object);
			this.triggerSlot(0, object, null, options);
		}
	}
	Motion.size = [260, 190];
	Motion.title = rotation ? "Rotate" : "Translate";
	Motion.desc = "On apply, integrate velocity using delta seconds (engine delta if unconnected). " + (rotation ? "Local Euler rotation, radians/sec." : "Position in parent axes, units/sec.");
	return Motion;
}

registerNunuNode("nunu/context", NunuContext, {category: "Scene", accepts: "Object3D", effect: "read"});
registerNunuNode("nunu/events", NunuEvents, {category: "Lifecycle", accepts: "Program", effect: "events"});
registerNunuNode("nunu/keyboard", NunuKeyboard, {category: "Input", accepts: "Program", effect: "read"});
registerNunuNode("nunu/mouse", NunuMouse, {category: "Input", accepts: "Program", effect: "read"});
registerNunuNode("nunu/transform_get", NunuGetTransform, {category: "Transforms", accepts: "Object3D", effect: "read"});
registerNunuNode("nunu/transform_set", NunuSetTransform, {category: "Transforms", accepts: "Object3D", effect: "write"});
registerNunuNode("nunu/translate", motionNode(false), {category: "Transforms", accepts: "Object3D", effect: "write"});
registerNunuNode("nunu/rotate", motionNode(true), {category: "Transforms", accepts: "Object3D", effect: "write"});
