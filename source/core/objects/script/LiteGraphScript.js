import {Group, Object3D} from "three";
import { LiteGraph, LGraph, LGraphCanvas } from "../../../lib/litegraph";
import { NunuObject } from "./litegraph_nodes/LiteGraphNunuNodes";
import { Program } from "../Program";
import { ObjectUtils } from "../../utils/ObjectUtils";

/**
 * Node scripts are build using a graph composed of operations.
 *
 * They can be used to create interaction without requiring any coding, logic can be build from provided blocks.
 *
 * @class LiteGraphScript
 * @extends {Object}
 * @module Script
 */
function LiteGraphScript(dataGraph)
{
	Group.call(this);

	console.debug("LiteGraphScript", "***CONSTRUCTING***", ...arguments);
	
	console.debug("LiteGraphScript", "***this***", this);
	console.debug("LiteGraphScript", "***looking for Program, Scene, App, Tab***");

	this.type = "LiteGraphScript";
	this.name = "LGScript";

	/**
	 * Node graph that composes this script.
	 *
	 * @attribute graph
	 * @type {LGraph}
	 */
	this.graph = new LGraph();
	this.graph.nunu_lgscript = this;
	
	if(dataGraph) this.configure(dataGraph);
}

LiteGraphScript.prototype = Object.create(Group.prototype);

LiteGraphScript.prototype.configure = function(dataGraph){
	this.graph.configure(dataGraph);
}

LiteGraphScript.prototype.getProgram = function(){
	return ObjectUtils.getRoot(this);
	// NO NEED: use ObjectUtils.getRoot
	// 	let parent = this.parent;
	// 	while(parent !== null){
	// 		if(typeof(parent.parent) == "undefined"){
	// 			break;
	// 		}
	// 		parent = parent.parent;
	// 	}
	// 	if(typeof(parent) == Program){
	// 		return parent;
	// 	}else{
	// 		return false;
	// 	}
}

/**
 * Initialize script, automatically called by the runtime.
 *
 * Compiles the script code and calls the script initialize method if it exists after the code is compiled.
 *
 * @method initialize
 */
LiteGraphScript.prototype.initialize = function()
{
	Object3D.prototype.initialize.call(this);

	// PLAY
	if(this.graph && typeof(this.graph.start)=="function"){
		console.debug("LiteGraphScript","***GRAN CAN RUN***");
		// this.graph.start();
	}else{
		console.debug("LiteGraphScript","***GRAN CANNOT RUN***",this.graph);
	}

	console.debug("LiteGraphScript","***INITIALIZE***",...arguments);
};

/**
 * Update node script state runs the update methods from the node graph.
 *
 * @method update
 */
LiteGraphScript.prototype.update = function(delta)
{
	// WORKING, in PLAY WILL RUN
	// console.debug("LiteGraphScript","update",...arguments);
	if(this.graph && typeof(this.graph.runStep)=="function"){
		this.graph.runStep();
	}

	Object3D.prototype.update.call(this, delta);
};

/**
 * Disposes the script, can be used to clear resources when the program exits.
 *
 * Calls the script dispose method if it exists.
 *
 * @method dispose
 */
LiteGraphScript.prototype.dispose = function()
{
	// STOP
	if(this.graph && typeof(this.graph.stop)=="function"){
		console.debug("LiteGraphScript","***GRAN CAN STOP***");
		this.graph.stop();
	}else{
		console.debug("LiteGraphScript","***GRAN CANNOT STOP***",this.graph);
	}
	console.debug("LiteGraphScript","***DISPOSE***",...arguments);

	Object3D.prototype.dispose.call(this);
};

/**
 * Call resize method if available.
 *
 * The resize method receives width and height as arguments.
 *
 * @method resize
 */
LiteGraphScript.prototype.resize = function(x, y)
{
	// TODO <ADD CODE HERE>
	console.debug("LiteGraphScript","resize",...arguments);
};

LiteGraphScript.prototype.toJSON = function(meta)
{
	var data = Object3D.prototype.toJSON.call(this, meta);

	console.debug("LiteGraphScript","toJSON", this.graph, ...arguments);

	if(this.graph && typeof(this.graph.serialize)=="function"){
		data.object.graph = this.graph.serialize();
		console.warn("LiteGraphScript","toJSON","serialized", data.object.graph);
	}else{
		console.warn("LiteGraphScript","toJSON","serialize not valid", "this.graph", this.graph, "data.object", data.object);
	}

	return data;
};

export {LiteGraphScript};
