// import {Renderer, Viewport, ViewportControls} from "escher.js/build/escher.module.js";
import { LiteGraph, LGraph, LGraphCanvas } from "../../../../lib/litegraph.js";
import {Canvas} from "../../../components/Canvas.js";
import {Global} from "../../../Global.js";
import {Locale} from "../../../locale/LocaleManager.js";
import {TabComponent} from "../../../components/tabs/TabComponent.js";
// import {SideBar} from "./SideBar.js";
import { Editor } from "../../../Editor.js";
// import { LiteGraphScript } from "../../../../core/objects/script/LiteGraphScript.js";

function LitegraphEditor(parent, closeable, container, index)
{
	TabComponent.call(this, parent, closeable, container, index, Locale.about, Global.FILE_PATH + "icons/misc/about.png");

	this.element.style.backgroundColor = "var(--bar-color)";
	
	/**
	 * LiteGraph script being edited in this tab.
	 * 
	 * @attribute graph
	 * @type {LiteGraphScript}
	 */
	this.node = null;

	/**
	 * Side bar contains the buttons to add new nodes into the node editor graph.
	 *
	 * @attribute sideBar
	 * @type {SideBar}
	 */
	// this.sideBar = new SideBar(this);

	/**
	 * Canvas used to display the graph.
	 * 
	 * @attribute canvas
	 * @type {Canvas}
	 */
	this.canvas = new Canvas(this);
	this.canvas.watchPointer();

    // classes reference
    this.LiteGraph = LiteGraph;
    this.LGraph = LGraph;
    this.LGraphCanvas = LGraphCanvas;

	// init empty
	this.graphcanvas = false;
	this.graph = false;

    LiteGraph.log_info("LiteGraphEditor","CONSTRUCT",...arguments);
}

LitegraphEditor.prototype = Object.create(TabComponent.prototype);

LitegraphEditor.prototype.updateMetadata = function()
{
    LiteGraph.log_info("LiteGraphEditor","updateMetadata",...arguments);
    this.setName("*LiteGraphEditor*");
	if (this.node !== null)
	{
		if(this.graphcanvas && this.graph){

		}else{
			if(this.node.graph && typeof(this.node.graph.attachCanvas)=="function"){
				this.graphcanvas = new LGraphCanvas(this.canvas.element, this.node.graph);
				this.graph = this.node.graph;
			}else{
				console.error("** graph is an object to be configured, it should be done by LiteGraphScript **", this.node);
				//this.graph = new LGraph(this.node.graph);
				//this.node.graph = this.graph;
				//this.graphcanvas = new LGraphCanvas(this.canvas.element, this.node.graph);
				//console.debug("** graph configured **", this.node.graph);
			}
			if(this.graphcanvas){
				this.graphcanvas.registerCallbackHandler("getExtraMenuOptions",function(oCbInfo, graphCanvas, options){
					console.info("**LG**","checkNunuEditor selection",Editor.selection);
					return ["nunucheck", function(){
						console.info("**NUNU_MENU**",this,...arguments);
					}]
				});
			}
		}
	}	
};

LitegraphEditor.prototype.attach = function(par)
{
    LiteGraph.log_info("LiteGraphEditor","attach",par);
	this.node = par;
	this.updateMetadata();
};

LitegraphEditor.prototype.isAttached = function(par)
{
    LiteGraph.log_info("LiteGraphEditor","isAttached",par);
	return this.node === par;
};

LitegraphEditor.prototype.destroy = function()
{
	TabComponent.prototype.destroy.call(this);
	LiteGraph.log_info("LiteGraphEditor","unbind LGraphCanvas events", this.graphcanvas);
	if(this.graphcanvas && typeof(this.graphcanvas.unbindEvents)=="function"){
		this.graphcanvas.unbindEvents();
	}
};

LitegraphEditor.prototype.update = function()
{
    // DBG VERBOSE LiteGraph.log_info("LiteGraphEditor","update",...arguments);
    LiteGraph.log_verbose("LiteGraphEditor","update",...arguments);

	// if (this.node !== null && this.node.graph !== null)
	// {
	// 	if (this.canvas.pointerInside)
	// 	{
	// 		// this.controls.update(this.renderer.pointer);  // REPLACE WITH LITEGRAPH
	// 	}

	// 	// this.renderer.update(this.node.graph, this.viewport);  // REPLACE WITH LITEGRAPH
	// }
};

LitegraphEditor.prototype.updateSize = function()
{
    LiteGraph.log_info("LiteGraphEditor","updateSize",...arguments);

	TabComponent.prototype.updateSize.call(this);

	// this.sideBar.position.set(0, 0);
	// this.sideBar.size.set(40, this.size.y);
	// this.sideBar.updateInterface();

	var width = this.size.x; // - this.sideBar.size.x;
	var height = this.size.y;

	// this.canvas.position.set(this.sideBar.size.x, 0);
	this.canvas.position.set(0, 0);
	this.canvas.size.set(width, height);
	this.canvas.updateInterface();
};

export {LitegraphEditor};
