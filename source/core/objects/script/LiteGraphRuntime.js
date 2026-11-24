/* eslint-disable camelcase -- LiteGraph public API and persisted UUID property names. */
import {LiteGraph, LGraph} from "../../../lib/litegraph.js";

function visitGraphs(graph, callback)
{
	callback(graph);
	for (var node of graph._nodes)
	{
		if (node.subgraph) { visitGraphs(node.subgraph, callback); }
	}
}

/**
 * A graph driven exclusively by the nunuStudio frame clock.
 *
 * LiteGraph's public start() owns a timer. This adapter dispatches the same
 * lifecycle hooks without scheduling a second loop. A synchronous clock scope
 * gives nested graphs and time nodes the engine time during each execution.
 */
class LiteGraphRuntime extends LGraph
{
	constructor()
	{
		super();
		this.engineTime = 0;
		this.startGeneration = 0;
	}

	withEngineClock(callback)
	{
		var previous = LiteGraph.getTime;
		var time = this.engineTime * 1000;
		LiteGraph.getTime = function() { return time; };
		try
		{
			return callback();
		}
		finally
		{
			LiteGraph.getTime = previous;
		}
	}

	start()
	{
		if (this.status === LGraph.STATUS_RUNNING)
		{
			return Promise.resolve(true);
		}
		if (this.startPending)
		{
			return this.startPending;
		}
		var self = this;
		var generation = ++this.startGeneration;
		var pending = this.whenIdle().then(function()
		{
			return self.whenReady();
		}).then(function()
		{
			if (generation !== self.startGeneration)
			{
				return false;
			}
			self.engineTime = 0;
			visitGraphs(self, function(graph)
			{
				graph.starttime = 0;
				graph.last_update_time = 0;
				graph.globaltime = 0;
				graph.fixedtime = 0;
				graph.elapsed_time = 0;
			});
			self.initialization_error = null;
			self.status = LGraph.STATUS_RUNNING;
			self.withEngineClock(function()
			{
				self.processCallbackHandlers("onPlayEvent", {def_cb: self.onPlayEvent});
				if (self.status === LGraph.STATUS_RUNNING)
				{
					self.sendEventToAllNodes("onStart", undefined, [LiteGraph.ALWAYS, LiteGraph.ON_EVENT, LiteGraph.ON_TRIGGER, LiteGraph.ON_REQUEST]);
				}
			});
			return self.status === LGraph.STATUS_RUNNING;
		}).catch(function(error)
		{
			if (generation !== self.startGeneration)
			{
				return false;
			}
			self.initialization_error = error;
			self.stop();
			throw error;
		});
		this.startPending = pending;
		pending.then(function()
		{
			if (self.startPending === pending) { self.startPending = null; }
		}, function()
		{
			if (self.startPending === pending) { self.startPending = null; }
		});
		return pending;
	}

	stop(options)
	{
		this.startGeneration++;
		this.startPending = null;
		if (this.engineTime === undefined) { return super.stop(options); }
		return this.withEngineClock(() =>
		{
			return super.stop(options);
		});
	}

	tick(delta)
	{
		if (this.status !== LGraph.STATUS_RUNNING)
		{
			return;
		}
		delta = Number.isFinite(delta) && delta >= 0 ? delta : 0;
		var previousTime = this.engineTime;
		this.engineTime += delta;
		visitGraphs(this, function(graph)
		{
			graph.elapsed_time = delta;
			graph.fixedtime_lapse = delta;
			graph.last_update_time = previousTime * 1000;
			graph.starttime = 0;
		});
		var self = this;
		this.withEngineClock(function()
		{
			self.processCallbackHandlers("onBeforeStep", {def_cb: self.onBeforeStep});
			self.runStep();
			// LiteGraph adds a minimum execution-duration diagnostic to globaltime.
			// Keep the externally visible simulation clock at the engine time.
			visitGraphs(self, function(graph) { graph.globaltime = self.engineTime; });
			self.processCallbackHandlers("onAfterStep", {def_cb: self.onAfterStep});
		});
	}
}

export {LiteGraphRuntime};
