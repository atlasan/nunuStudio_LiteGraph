/* eslint-disable camelcase -- LiteGraph public API and persisted UUID property names. */
import {LGraphCanvas} from "../../../../lib/litegraph.js";
import {Canvas} from "../../../components/Canvas.js";
import {Global} from "../../../Global.js";
import {Locale} from "../../../locale/LocaleManager.js";
import {TabComponent} from "../../../components/tabs/TabComponent.js";
import {Editor} from "../../../Editor.js";

function LitegraphEditor(parent, closeable, container, index)
{
	TabComponent.call(this, parent, closeable, container, index, Locale.litegraphGraph, Global.FILE_PATH + "icons/script/workflow.png");
	this.element.style.backgroundColor = "var(--bar-color)";
	this.node = null;
	this.graphcanvas = null;
	this.canvas = new Canvas(this);
	this.selectionProvider = function()
	{
		return Editor.selection.length ? Editor.selection[0] : null;
	};
}

LitegraphEditor.prototype = Object.create(TabComponent.prototype);

LitegraphEditor.prototype.updateMetadata = function()
{
	if (this.node !== null) { this.setName(this.node.name); }
};

LitegraphEditor.prototype.releaseGraph = function()
{
	if (this.graphcanvas !== null)
	{
		this.graphcanvas.dispose();
		this.graphcanvas = null;
	}
	if (this.node && this.node.graph.nunuSelection === this.selectionProvider)
	{
		delete this.node.graph.nunuSelection;
	}
};

LitegraphEditor.prototype.attach = function(node)
{
	this.releaseGraph();
	this.node = node;
	if (node)
	{
		node.graph.nunuSelection = this.selectionProvider;
		// Tab updates own rendering too, so hidden/closed tabs have no RAF loop.
		this.graphcanvas = new LGraphCanvas(this.canvas.element, node.graph, {skip_render: true, hide_widget_label_when_small: 0});
		this.resizeGraph();
	}
	this.updateMetadata();
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
	this.canvas.position.set(0, 0);
	this.canvas.size.set(this.size.x, this.size.y);
	this.canvas.updateInterface();
	this.resizeGraph();
};

export {LitegraphEditor};
