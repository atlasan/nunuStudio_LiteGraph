/* eslint-disable camelcase -- LiteGraph public API and persisted UUID property names. */
import {LiteGraph, LGraphCanvas} from "../../../../lib/litegraph.js";
import {Canvas} from "../../../components/Canvas.js";
import {Global} from "../../../Global.js";
import {Locale} from "../../../locale/LocaleManager.js";
import {TabComponent} from "../../../components/tabs/TabComponent.js";
import {Editor} from "../../../Editor.js";
import {Component} from "../../../components/Component.js";
import {canBindObject} from "../../../../core/objects/script/LiteGraphContext.js";
import {addRotationStarter, getNunuExampleCatalog, acceptsExample, addVisualScriptExample} from "../../../../core/objects/script/LiteGraphStarter.js";
import {getNunuNodeCatalog} from "../../../../core/objects/script/LiteGraphNodeCatalog.js";
import {DragBuffer} from "../../DragBuffer.js";
import {seedGraphHistory} from "./GraphHistory.js";
import {dropSceneObject, canReference} from "./GraphObjectDrop.js";

function LitegraphEditor(parent, closeable, container, index)
{
	TabComponent.call(this, parent, closeable, container, index, Locale.litegraphGraph, Global.FILE_PATH + "icons/script/workflow.png");
	this.element.style.backgroundColor = "var(--bar-color)";
	this.node = null;
	this.graphcanvas = null;
	this.unsubscribers = [];
	this.canvas = new Canvas(this);
	this.selectionProvider = function()
	{
		return Editor.selection.length ? Editor.selection[0] : null;
	};
	this.createToolbar();
	this.createPalette();
	var self = this;
	this.feedback = function(message) { self.setStatus(message); };
	this.onGraphKey = function(event)
	{
		if (event.ctrlKey || event.metaKey)
		{
			if (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y")
			{
				event.preventDefault();
				event.stopImmediatePropagation();
				self.changeHistory(event.key.toLowerCase() === "y" || event.shiftKey);
			}
		}
		// Graph delete, copy and paste must never reach the scene shortcuts.
		else if (event.key === "Delete" || event.key === "Backspace")
		{
			event.preventDefault();
			event.stopImmediatePropagation();
			self.graphcanvas.deleteSelectedNodes();
		}
	};
	this.canvas.element.addEventListener("keydown", this.onGraphKey, true);
	this.revealObject = function(object)
	{
		Editor.selectObject(object);
		self.setStatus("Selected " + (object.name || object.type) + " in the scene.");
	};
	// Scene tree drags carry the object UUID; handle them before LiteGraph's own drop logic.
	this.onDragOver = function(event)
	{
		if (self.draggedObject(event))
		{
			event.preventDefault();
			event.dataTransfer.dropEffect = "link";
		}
	};
	this.onDrop = function(event)
	{
		var object = self.draggedObject(event);
		if (!object || !self.graphcanvas) { return; }
		event.preventDefault();
		event.stopImmediatePropagation();
		self.dropObject(object, event);
	};
	this.canvas.element.addEventListener("dragover", this.onDragOver, true);
	this.canvas.element.addEventListener("drop", this.onDrop, true);
}

LitegraphEditor.prototype = Object.create(TabComponent.prototype);

LitegraphEditor.prototype.updateMetadata = function()
{
	if (this.node !== null) { this.setName(this.node.name); }
};

LitegraphEditor.prototype.releaseGraph = function()
{
	for (var unsubscribe of this.unsubscribers || []) { unsubscribe(); }
	this.unsubscribers = [];
	if (this.graphcanvas !== null)
	{
		this.graphcanvas.dispose();
		this.graphcanvas = null;
	}
	if (this.node && this.node.graph.nunuSelection === this.selectionProvider)
	{
		delete this.node.graph.nunuSelection;
		delete this.node.graph.nunuFeedback;
		delete this.node.graph.nunuReveal;
	}
};

LitegraphEditor.prototype.attach = function(node)
{
	this.releaseGraph();
	this.node = node;
	if (node)
	{
		node.graph.nunuSelection = this.selectionProvider;
		node.graph.nunuFeedback = this.feedback;
		node.graph.nunuReveal = this.revealObject;
		seedGraphHistory(node.graph);
		var self = this;
		this.unsubscribers = [node.graph.events.on("graph-changed", function()
		{
			if (self.seeding) { return; }
			self.seeding = true;
			try { seedGraphHistory(node.graph); }
			finally { self.seeding = false; }
			self.updateStatus();
		})];
		// Tab updates own rendering too, so hidden/closed tabs have no RAF loop.
		this.graphcanvas = new LGraphCanvas(this.canvas.element, node.graph, {skip_render: true, hide_widget_label_when_small: 0});
		this.resizeGraph();
	}
	this.updateMetadata();
	this.updateStatus();
};

LitegraphEditor.prototype.isAttached = function(node)
{
	return this.node === node;
};

LitegraphEditor.prototype.destroy = function()
{
	this.active = false;
	this.releaseGraph();
	this.node = null;
	if (this.onGraphKey) { this.canvas.element.removeEventListener("keydown", this.onGraphKey, true); }
	if (this.onDrop)
	{
		this.canvas.element.removeEventListener("dragover", this.onDragOver, true);
		this.canvas.element.removeEventListener("drop", this.onDrop, true);
	}
	TabComponent.prototype.destroy.call(this);
};

LitegraphEditor.prototype.update = function()
{
	if (this.graphcanvas && this.active) { this.graphcanvas.draw(); }
};

LitegraphEditor.prototype.resizeGraph = function()
{
	if (this.graphcanvas)
	{
		var ratio = Editor.getPixelRatio();
		this.graphcanvas.pixel_ratio = ratio;
		this.graphcanvas.ds.pixel_ratio = ratio;
		this.graphcanvas.bgcanvas.width = this.canvas.element.width;
		this.graphcanvas.bgcanvas.height = this.canvas.element.height;
		this.graphcanvas.setDirty(true, true);
	}
};

LitegraphEditor.prototype.updateSize = function()
{
	TabComponent.prototype.updateSize.call(this);
	var top = this.palette ? 76 : this.toolbar ? 36 : 0;
	var bottom = this.status ? 26 : 0;
	this.canvas.position.set(0, top);
	this.canvas.size.set(this.size.x, Math.max(0, this.size.y - top - bottom));
	if (this.toolbar)
	{
		this.toolbar.position.set(0, 0);
		this.toolbar.size.set(this.size.x, 36);
		if (this.palette)
		{
			this.palette.position.set(0, 36);
			this.palette.size.set(this.size.x, 40);
			this.palette.updateInterface();
		}
		this.toolbar.updateInterface();
		this.status.position.set(0, this.size.y - bottom);
		this.status.size.set(this.size.x, bottom);
		this.status.updateInterface();
	}
	this.canvas.updateInterface();
	this.resizeGraph();
};

LitegraphEditor.prototype.createToolbar = function()
{
	this.toolbar = new Component(this, "div");
	this.toolbar.element.className = "visual-script-toolbar";
	this.status = new Component(this, "div");
	this.status.element.className = "visual-script-status";
	this.status.element.setAttribute("role", "status");
	this.status.element.setAttribute("aria-live", "polite");
	var self = this;
	function button(label, action)
	{
		var element = document.createElement("button");
		element.type = "button";
		element.textContent = label;
		element.addEventListener("click", function()
		{
			action();
			self.canvas.element.focus();
		});
		self.toolbar.element.appendChild(element);
		return element;
	}
	this.referenceButton = button("Reference selected", function() { self.referenceSelected(); });
	this.referenceButton.title = "Add a Nunu Object node bound to the selected scene object. You can also drag objects from the scene tree onto the graph.";
	this.starterButton = button("Spin selected", function() { self.addStarter(); });
	button("Bind selected", function() { self.bindSelected(); }).title = "Bind the selected Nunu Object nodes to the selected scene object.";
	button("Frame all", function() { self.frameAll(); });
	button("Undo", function() { self.changeHistory(false); });
	button("Redo", function() { self.changeHistory(true); });
	button("Check", function() { self.updateStatus(); });
	button("Run", function()
	{
		if (self.node.getDiagnostics().some(function(issue) { return issue.severity === "error"; }))
		{
			self.updateStatus();
			return;
		}
		Editor.runProject();
	});
};

LitegraphEditor.prototype.createPalette = function()
{
	this.palette = new Component(this, "div");
	this.palette.element.className = "visual-script-toolbar visual-script-palette";
	var self = this;
	function select(label)
	{
		var element = document.createElement("select");
		element.setAttribute("aria-label", label);
		self.palette.element.appendChild(element);
		return element;
	}
	function option(selectElement, value, title)
	{
		var element = document.createElement("option");
		element.value = value;
		element.textContent = title;
		selectElement.appendChild(element);
	}
	function button(label, callback)
	{
		var element = document.createElement("button");
		element.type = "button";
		element.textContent = label;
		element.addEventListener("click", callback);
		self.palette.element.appendChild(element);
		return element;
	}
	this.searchInput = document.createElement("input");
	this.searchInput.type = "search";
	this.searchInput.placeholder = "Search nodes";
	this.searchInput.setAttribute("aria-label", "Search nodes");
	this.palette.element.appendChild(this.searchInput);
	this.categorySelect = select("Node category");
	this.nodeSelect = select("Nunu node");
	var catalog = getNunuNodeCatalog();
	option(this.categorySelect, "", "All categories");
	for (var category of Array.from(new Set(catalog.map(function(item) { return item.category; })))) { option(this.categorySelect, category, category); }
	this.categorySelect.value = "Scene";
	function fillNodes()
	{
		var words = self.searchInput.value.toLowerCase().split(/\s+/).filter(Boolean);
		var matches = catalog.filter(function(item)
		{
			var text = (item.title + " " + item.category + " " + item.type + " " + item.accepts + " " + item.description).toLowerCase();
			// A search looks through every category; the category only narrows browsing.
			return words.length ? words.every(function(word) { return text.includes(word); }) : !self.categorySelect.value || item.category === self.categorySelect.value;
		});
		self.nodeSelect.textContent = "";
		for (var definition of matches)
		{
			option(self.nodeSelect, definition.type, words.length || !self.categorySelect.value ? definition.category + ": " + definition.title : definition.title);
		}
		self.nodeSelect.disabled = matches.length === 0;
		if (self.addNodeButton) { self.addNodeButton.disabled = matches.length === 0; }
		self.nodeSelect.title = matches.length ? matches[0].description : "No node matches the search.";
		return matches;
	}
	this.categorySelect.addEventListener("change", fillNodes);
	this.searchInput.addEventListener("input", function()
	{
		var matches = fillNodes();
		self.setStatus(matches.length ? matches.length + " node(s) match. Enter adds " + matches[0].title + "." : "No node matches \"" + self.searchInput.value + "\".");
	});
	this.searchInput.addEventListener("keydown", function(event)
	{
		if (event.key === "Enter" && self.nodeSelect.value)
		{
			event.preventDefault();
			self.addCatalogNode(self.nodeSelect.value);
		}
		else if (event.key === "Escape")
		{
			self.searchInput.value = "";
			fillNodes();
		}
		event.stopPropagation();
	});
	this.nodeSelect.addEventListener("change", function()
	{
		var definition = catalog.find(function(item) { return item.type === self.nodeSelect.value; });
		self.nodeSelect.title = definition.description;
		self.setStatus(definition.title + ": " + definition.description);
	});
	this.addNodeButton = button("Add node", function() { self.addCatalogNode(self.nodeSelect.value); });
	fillNodes();
	this.exampleSelect = select("Starter example");
	for (var example of getNunuExampleCatalog()) { option(this.exampleSelect, example.id, example.title); }
	this.exampleSelect.title = "Examples marked with a requirement need a different selected object.";
	this.exampleSelect.addEventListener("change", function()
	{
		self.updateStatus();
		var example = getNunuExampleCatalog().find(function(item) { return item.id === self.exampleSelect.value; });
		self.setStatus(example.description + " Select a " + example.accepts + " in this script's scene.");
	});
	this.exampleButton = button("Add example", function()
	{
		var object = self.selectionProvider();
		var example = getNunuExampleCatalog().find(function(item) { return item.id === self.exampleSelect.value; });
		if (!canBindObject(self.node, object) || !acceptsExample(example, object))
		{
			self.setStatus("Select a " + example.accepts + " in this script's scene first.");
			return;
		}
		addVisualScriptExample(self.node.graph, example.id, object.uuid);
		self.frameAll();
		self.updateStatus();
	});
};

LitegraphEditor.prototype.addCatalogNode = function(type)
{
	if (!this.graphcanvas) { return; }
	var definition = getNunuNodeCatalog().find(function(item) { return item.type === type; });
	if (!definition) { return; }
	var canvas = this.graphcanvas;
	var node;
	canvas.graph.transact("Add " + definition.title, function()
	{
		node = LiteGraph.createNode(type);
		node.pos = canvas.convertCanvasToOffset([canvas.cssWidth / 2, canvas.cssHeight / 2]);
		canvas.graph.add(node);
	});
	canvas.selectNode(node);
	this.canvas.element.focus();
	this.updateStatus();
};

LitegraphEditor.prototype.setStatus = function(message)
{
	if (this.status)
	{
		this.status.element.textContent = message;
		this.status.element.title = message;
	}
};

LitegraphEditor.prototype.updateStatus = function()
{
	if (!this.node) { return; }
	var selected = this.selectionProvider();
	var eligible = canBindObject(this.node, selected);
	if (this.starterButton) { this.starterButton.disabled = !eligible || selected === this.node || selected.type === "Scene"; }
	if (this.exampleSelect && this.exampleButton)
	{
		var example = getNunuExampleCatalog().find((item) => { return item.id === this.exampleSelect.value; });
		this.exampleButton.disabled = !eligible || !acceptsExample(example, selected);
		for (var item of getNunuExampleCatalog())
		{
			var element = this.exampleSelect.querySelector("option[value=\"" + item.id + "\"]");
			if (element) { element.textContent = item.title + (eligible && acceptsExample(item, selected) ? "" : " (needs " + item.accepts + ")"); }
		}
	}
	if (this.referenceButton) { this.referenceButton.disabled = !canReference(this.node, selected); }
	var issues = this.node.getDiagnostics();
	if (issues.length)
	{
		this.setStatus(issues.length + " issue(s): " + issues.map(function(issue)
		{
			return (issue.node ? "Node " + issue.node + ": " : "") + issue.message;
		}).join(" "));
	}
	else if (this.node.graph._nodes.length === 0)
	{
		this.setStatus("Drag objects from the scene tree onto the graph, search and Add node, or select an object and Add example.");
	}
	else
	{
		this.setStatus("Graph ready. " + (eligible ? "Selected: " + (selected.name || selected.type) + ". " : "") + (Editor.settings && Editor.settings.general.immediateMode ? "Run uses immediate mode; it can change scene objects." : "Run previews a copy; Save keeps the graph with your project."));
	}
};

LitegraphEditor.prototype.updateSelection = function()
{
	this.updateStatus();
};

/** The scene object carried by a tree drag, or null for any other drag. */
LitegraphEditor.prototype.draggedObject = function(event)
{
	var object = DragBuffer.buffer.find(function(item) { return item && item.isObject3D; }) || null;
	if (event.type === "drop")
	{
		var uuid = event.dataTransfer.getData("uuid");
		object = uuid ? DragBuffer.get(uuid) : null;
	}
	return object && object.isObject3D ? object : null;
};

LitegraphEditor.prototype.dropObject = function(object, event)
{
	var canvas = this.graphcanvas;
	var position = canvas.convertEventToCanvasOffset(event);
	var target = canvas.graph.getNodeOnPos(position[0], position[1], canvas.visible_nodes);
	var slot = target ? canvas.isOverNodeInput(target, position[0], position[1]) : -1;
	var outcome = dropSceneObject(canvas.graph, this.node, object, position, target, slot);
	if (outcome.node) { canvas.selectNode(outcome.node); }
	canvas.setDirty(true, true);
	this.canvas.element.focus();
	this.updateStatus();
	this.setStatus(outcome.message);
};

LitegraphEditor.prototype.referenceSelected = function()
{
	if (!this.graphcanvas) { return; }
	var canvas = this.graphcanvas;
	var object = this.selectionProvider();
	var center = canvas.convertCanvasToOffset([canvas.cssWidth / 2, canvas.cssHeight / 2]);
	var outcome = dropSceneObject(canvas.graph, this.node, object, center, null, -1);
	if (outcome.node) { canvas.selectNode(outcome.node); }
	this.updateStatus();
	this.setStatus(outcome.ok ? outcome.message : "Select an object in this script's scene first.");
};

LitegraphEditor.prototype.addStarter = function()
{
	var selected = this.selectionProvider();
	if (!this.node || !canBindObject(this.node, selected) || selected === this.node || selected.type === "Scene")
	{
		this.setStatus("Select an object in this script's scene first.");
		return;
	}
	addRotationStarter(this.node.graph, selected.uuid);
	this.frameAll();
	this.updateStatus();
};

LitegraphEditor.prototype.bindSelected = function()
{
	if (!this.graphcanvas) { return; }
	var object = this.selectionProvider();
	if (!canBindObject(this.node, object))
	{
		this.setStatus("Select an object in this script's scene first.");
		return;
	}
	var references = Object.values(this.graphcanvas.selected_nodes).filter(function(node) { return node.type === "nunu/object"; });
	if (!references.length)
	{
		this.setStatus("Select a Nunu Object node in the graph, then choose Bind selected.");
		return;
	}
	this.graphcanvas.graph.transact("Bind scene objects", function()
	{
		for (var reference of references) { reference.setProperty("nunu_uuid", object.uuid); }
	});
	this.updateStatus();
};

LitegraphEditor.prototype.frameAll = function()
{
	var canvas = this.graphcanvas;
	if (!canvas || !canvas.graph._nodes.length) { return; }
	var left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
	for (var node of canvas.graph._nodes)
	{
		left = Math.min(left, node.pos[0]);
		top = Math.min(top, node.pos[1] - 40);
		right = Math.max(right, node.pos[0] + node.size[0]);
		bottom = Math.max(bottom, node.pos[1] + node.size[1]);
	}
	var scale = Math.min(1, Math.max(0.1, Math.min((canvas.cssWidth - 60) / Math.max(1, right - left), (canvas.cssHeight - 60) / Math.max(1, bottom - top))));
	canvas.ds.scale = scale;
	canvas.ds.offset[0] = (canvas.cssWidth / scale - left - right) / 2;
	canvas.ds.offset[1] = (canvas.cssHeight / scale - top - bottom) / 2;
	canvas.setDirty(true, true);
};

LitegraphEditor.prototype.changeHistory = function(forward)
{
	if (!this.graphcanvas) { return; }
	var graph = this.graphcanvas.graph;
	var changed = forward ? graph.actionHistoryForward() : graph.actionHistoryBack();
	this.updateStatus();
	if (!changed) { this.setStatus(forward ? "Nothing to redo in this graph." : "Nothing to undo in this graph."); }
};

LitegraphEditor.prototype.ownsKeyboardFocus = function()
{
	return this.active && this.element.contains(this.canvas.element.ownerDocument.activeElement);
};

export {LitegraphEditor};
