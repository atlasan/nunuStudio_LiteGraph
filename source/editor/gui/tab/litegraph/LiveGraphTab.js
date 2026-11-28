import {LGraph, LGraphCanvas} from "../../../../lib/litegraph/litegraph.mini.js";
import {Canvas} from "../../../components/Canvas.js";
import {TabComponent} from "../../../components/tabs/TabComponent.js";
import {Editor} from "../../../Editor.js";
import {Global} from "../../../Global.js";
import {Locale} from "../../../locale/LocaleManager.js";
import {RunProject} from "../run/RunProject.js";

const pulseLifetime = 450;
const pulseColor = "#75f8c6";

function displayValue(value)
{
	if (value === undefined) {return "—";}
	if (value === null) {return "null";}
	if (value.isObject3D) {return value.name || value.type;}
	if (Array.isArray(value) || ArrayBuffer.isView(value))
	{
		return "[" + Array.prototype.slice.call(value, 0, 5).map((item) => String(item)).join(", ") +
			(value.length > 5 ? ", …]" : "]");
	}
	return typeof value === "object" ? (value.constructor && value.constructor.name || "Object") : String(value);
}

function pathOf(script, scene)
{
	const path = [];
	for (let object = script; object && object !== scene; object = object.parent)
	{
		path.unshift(object.name || object.type);
	}
	return path.join(" / ");
}

class LiveGraphCanvas extends LGraphCanvas
{
	constructor(canvas)
	{
		super(canvas, null, {skip_events: true, skip_render: true});
		this.read_only = true;
		this.activity = new Map();
	}

	sample(now)
	{
		const current = new Map();
		for (const link of Object.values(this.graph.links))
		{
			const previous = this.activity.get(link.id);
			const time = link._last_time;
			const value = displayValue(link.data);
			const changed = previous && (previous.time !== time || previous.value !== value);
			const until = changed ? now + pulseLifetime : previous ? previous.until : 0;
			current.set(link.id, {time, value, until, active: link.data === true || until > now});
		}
		this.activity = current;
		this.setDirty(true, true);
	}

	renderLinkPath(ctx, points, link, skipBorder, flow, color, startDir, endDir)
	{
		const activity = link && this.activity.get(link.id);
		if (skipBorder && link && color === "white") {return;}
		const highlight = activity && activity.active;
		const width = this.connections_width;
		if (highlight) {this.connections_width = Math.max(width, 2 / this.ds.scale);}
		try
		{
			super.renderLinkPath(ctx, points, link, skipBorder, highlight ? 0.7 : flow,
				highlight ? pulseColor : color, startDir, endDir);
		}
		finally
		{
			this.connections_width = width;
		}
	}
}

class LiveGraphTab extends TabComponent
{
	constructor(parent, closeable, container, index)
	{
		super(parent, closeable, container, index, Locale.liveGraph, Global.FILE_PATH + "icons/script/workflow.png");
		this.element.classList.add("litegraph", "live-graph");
		const header = document.createElement("div");
		header.className = "live-graph-controls";
		this.picker = document.createElement("select");
		this.picker.setAttribute("aria-label", Locale.runningGraph);
		this.fit = document.createElement("button");
		this.fit.textContent = Locale.fitLiveGraph;
		this.fit.addEventListener("click", () => this.fitGraph());
		this.focusPreview = document.createElement("button");
		this.focusPreview.textContent = Locale.focusRunPreview;
		this.focusPreview.addEventListener("click", () =>
		{
			const run = Editor.gui.tab.getTab(RunProject, Editor.program);
			if (!run) {return;}
			if (run.active) {run.focusPreview();}
			else {run.select();}
		});
		this.status = document.createElement("span");
		header.append(this.picker, this.fit, this.focusPreview, this.status);
		this.element.appendChild(header);

		this.canvas = new Canvas(this);
		this.canvas.element.setAttribute("aria-label", Locale.liveGraph);
		this.graphCanvas = new LiveGraphCanvas(this.canvas.element);
		this.values = document.createElement("output");
		this.values.className = "live-graph-values";
		this.element.appendChild(this.values);
		this.entries = [];
		this.selection = null;
		this.node = null;

		this.picker.addEventListener("change", () => this.attach(this.entries[this.picker.selectedIndex]));
		this.canvas.element.addEventListener("wheel", (event) =>
		{
			event.preventDefault();
			const rect = this.canvas.element.getBoundingClientRect();
			const center = [event.clientX - rect.left, event.clientY - rect.top];
			const scale = this.graphCanvas.ds.scale * Math.exp(-event.deltaY / 600);
			this.graphCanvas.ds.changeScale(scale, center);
		});
		this.canvas.element.addEventListener("pointerdown", (event) => this.panOrInspect(event));
	}

	panOrInspect(event)
	{
		const canvas = this.canvas.element;
		const view = this.graphCanvas;
		if (!view.graph || event.button !== 0) {return;}
		event.preventDefault();
		const {pointerId, clientX, clientY} = event;
		const [x, y] = view.convertEventToCanvasOffset(event);
		const node = view.graph.getNodeOnPos(x, y);
		const offset = view.ds.offset.slice();
		canvas.setPointerCapture(pointerId);
		canvas.onpointermove = (move) =>
		{
			view.ds.offset[0] = offset[0] + (move.clientX - clientX) / view.ds.scale;
			view.ds.offset[1] = offset[1] + (move.clientY - clientY) / view.ds.scale;
		};
		canvas.onpointerup = (up) =>
		{
			if (Math.hypot(up.clientX - clientX, up.clientY - clientY) < 5) {this.node = node;}
		};
		canvas.onlostpointercapture = () =>
		{
			canvas.onpointerup = null;
			canvas.onpointermove = null;
		};
	}

	update()
	{
		const run = Editor.gui.tab.getTab(RunProject, Editor.program);
		const scene = run && run.program && run.program.scene;
		const entries = [];
		if (scene)
		{
			scene.traverse((script) =>
			{
				if (script.type === "LiteGraphScript" && script.graph.status === LGraph.STATUS_RUNNING)
				{
					entries.push(script);
				}
			});
		}
		if (entries.length !== this.entries.length || entries.some((entry, i) => entry !== this.entries[i]))
		{
			this.entries = entries;
			const labels = entries.map((script) => pathOf(script, scene));
			this.picker.replaceChildren(...entries.map((script, i) =>
			{
				const option = document.createElement("option");
				option.textContent = labels.indexOf(labels[i]) === labels.lastIndexOf(labels[i]) ?
					labels[i] : labels[i] + " (" + script.uuid.slice(0, 8) + ")";
				return option;
			}));
			this.attach(entries.includes(this.selection) ? this.selection : entries[0]);
		}
		this.picker.disabled = entries.length === 0;
		this.fit.disabled = this.picker.disabled;
		this.focusPreview.disabled = !run || !run.program;
		const status = entries.length ? Locale.liveGraphInspect : run ? Locale.noRunningGraphs : Locale.runToInspectGraphs;
		if (this.status.textContent !== status) {this.status.textContent = status;}
		if (this.graphCanvas.graph)
		{
			this.graphCanvas.sample(performance.now());
		}
		const values = this.node ? this.node.title + "  ·  " +
			(this.node.outputs || []).map((slot, i) => slot.name + " = " + displayValue(this.node.getOutputData(i))).join("  ·  ") : "";
		if (values !== this.values.textContent) {this.values.textContent = values;}
	}

	attach(script)
	{
		this.selection = script || null;
		this.picker.selectedIndex = this.entries.indexOf(script);
		this.node = null;
		const view = this.graphCanvas;
		view.activity.clear();
		view.setGraph(script ? script.graph : null);
		this.fitGraph();
		view.setDirty(true, true);
	}

	fitGraph()
	{
		const view = this.graphCanvas;
		if (!view.graph || view.graph._nodes.length === 0) {return;}
		let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
		for (const node of view.graph._nodes)
		{
			left = Math.min(left, node.pos[0]);
			top = Math.min(top, node.pos[1] - 30);
			right = Math.max(right, node.pos[0] + node.size[0]);
			bottom = Math.max(bottom, node.pos[1] + node.size[1]);
		}
		const {x: width, y: height} = this.canvas.size;
		const scale = Math.max(0.1, Math.min(1, (width - 24) / (right - left), (height - 20) / (bottom - top)));
		view.ds.scale = scale;
		view.ds.offset[0] = (width / scale - (left + right)) / 2;
		view.ds.offset[1] = (height / scale - (top + bottom)) / 2;
		view.setDirty(true, true);
	}

	activate()
	{
		super.activate();
		this.graphCanvas.startRendering();
	}

	deactivate()
	{
		this.graphCanvas.stopRendering();
		this.attach(null);
		this.entries = [];
		super.deactivate();
	}

	updateSize()
	{
		super.updateSize();
		this.canvas.position.set(0, 34);
		this.canvas.size.set(this.size.x, Math.max(0, this.size.y - 60));
		this.canvas.updateInterface();
		this.graphCanvas.setDirty(true, true);
	}

	destroy()
	{
		this.graphCanvas.dispose();
		super.destroy();
	}
}

export {LiveGraphTab};
