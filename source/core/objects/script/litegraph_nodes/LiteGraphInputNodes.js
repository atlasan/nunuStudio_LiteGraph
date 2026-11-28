import {LiteGraph} from "../../../../lib/litegraph/litegraph.mini.js";
import {registerNunuNode} from "../LiteGraphNodeCatalog.js";
import {firstInputFrame, scriptContext} from "../LiteGraphContext.js";

const keyNames = new Map([
	[9, "Tab"], [13, "Enter"], [16, "Shift"], [17, "Ctrl"], [18, "Alt"], [27, "Esc"],
	[32, "Space"], [37, "Left"], [38, "Up"], [39, "Right"], [40, "Down"], [46, "Delete"]
]);
const buttonNames = ["Left", "Middle", "Right", "Back", "Forward"];

function keyName(code)
{
	if (keyNames.has(code)) {return keyNames.get(code);}
	if (code >= 65 && code <= 90 || code >= 48 && code <= 57) {return String.fromCharCode(code);}
	return "Key " + code;
}

function transitions(keys)
{
	const result = {pressed: [], released: [], held: []};
	keys.forEach((key, index) =>
	{
		if (key.justPressed) {result.pressed.push(index);}
		if (key.justReleased) {result.released.push(index);}
		if (key.pressed) {result.held.push(index);}
	});
	return result;
}

function describe(state, name, previous)
{
	const parts = [];
	if (state.pressed.length) {parts.push(state.pressed.map(name).join("+") + " pressed");}
	if (state.released.length) {parts.push(state.released.map(name).join("+") + " released");}
	return parts.length ? parts.join(" · ") : previous;
}

class InputMonitor
{
	constructor()
	{
		this.addOutput("keyboard status", "string");
		this.addOutput("buttons status", "string");
		this.addOutput("pointer status", "string");
		this.addOutput("key pressed", LiteGraph.EVENT);
		this.addOutput("key released", LiteGraph.EVENT);
		this.addOutput("button pressed", LiteGraph.EVENT);
		this.addOutput("button released", LiteGraph.EVENT);
		this.addOutput("pointer moved", LiteGraph.EVENT);
		this.addOutput("scrolled", LiteGraph.EVENT);
		this.reset();
	}

	reset()
	{
		this.lastKey = "no key events";
		this.lastButton = "no button events";
		this.lastScroll = 0;
		this.sample = null;
	}

	onStart()
	{
		this.reset();
	}

	samplePreviewInput(program)
	{
		const {keyboard, mouse} = program;
		if (!keyboard || !mouse) {return;}
		const keys = transitions(keyboard.keys);
		const buttons = transitions(mouse.keys);
		const buttonName = (index) => buttonNames[index];
		this.lastKey = describe(keys, keyName, this.lastKey);
		this.lastButton = describe(buttons, buttonName, this.lastButton);
		if (mouse.wheel) {this.lastScroll = mouse.wheel;}
		const position = mouse.position.toArray();
		const delta = mouse.delta.toArray();
		this.sample = {keys, buttons, position, delta, wheel: mouse.wheel};
		this.setOutputData(0, "Keys held: " + (keys.held.map(keyName).join("+") || "none") + "  ·  " + this.lastKey);
		this.setOutputData(1, "Buttons held: " + (buttons.held.map(buttonName).join("+") || "none") + "  ·  " + this.lastButton);
		this.setOutputData(2, "Pointer: " + position.map(Math.round).join(", ") + "  ·  Move: " +
			delta.map(Math.round).join(", ") + "  ·  Last scroll: " + Math.round(this.lastScroll));
	}

	onExecute()
	{
		if (!this.sample || !firstInputFrame(this, scriptContext(this).program)) {return;}
		const {keys, buttons, position, delta, wheel} = this.sample;
		keys.pressed.forEach((code) => this.triggerSlot(3, code));
		keys.released.forEach((code) => this.triggerSlot(4, code));
		buttons.pressed.forEach((button) => this.triggerSlot(5, button));
		buttons.released.forEach((button) => this.triggerSlot(6, button));
		if (delta[0] || delta[1]) {this.triggerSlot(7, {position, delta});}
		if (wheel) {this.triggerSlot(8, wheel);}
	}
}
InputMonitor.title = "Keyboard and Mouse Monitor";
InputMonitor.desc = "Observe every key and mouse button in this run, as well as movement and scrolling.";

class DisplayText
{
	constructor()
	{
		this.addInput("text object", "nunu_object,object");
		this.addInput("text", "string");
	}

	onExecute()
	{
		const object = this.getInputData(0);
		const text = this.getInputData(1);
		if (object && object.type === "TextSprite" && typeof text === "string" && object.text !== text)
		{
			object.text = text;
		}
	}
}
DisplayText.title = "Display Text";
DisplayText.desc = "Set the text on a scene TextSprite.";

registerNunuNode("nunu/input/monitor", InputMonitor, {category: "Input", accepts: "Program", effect: "read"});
registerNunuNode("nunu/text/display", DisplayText, {category: "Scene", accepts: "TextSprite", effect: "write"});
