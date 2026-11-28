import {LGraphCanvas, LiteGraph} from "../../../../lib/litegraph/litegraph.mini.js";
import "../../../../lib/litegraph/litegraph.css";
import {Canvas} from "../../../components/Canvas.js";
import {TabComponent} from "../../../components/tabs/TabComponent.js";
import {Editor} from "../../../Editor.js";
import {Global} from "../../../Global.js";
import {Locale} from "../../../locale/LocaleManager.js";

class LiteGraphEditor extends TabComponent
{
	constructor(parent, closeable, container, index)
	{
		super(parent, closeable, container, index, Locale.liteGraphScript, Global.FILE_PATH + "icons/script/workflow.png");

		this.element.classList.add("litegraph");
		this.script = null;
		this.canvas = new Canvas(this);
		this.graphCanvas = new LGraphCanvas(this.canvas.element, null, {skip_render: true});
		this.removeBindingMenu = LiteGraph.menus.register("node", ({canvas, node}) =>
		{
			if (canvas !== this.graphCanvas || this.script === null || node.type !== "nunu/object")
			{
				return [];
			}

			const object = Editor.selection[0];
			const scene = this.script.getScene();
			return [{
				content: Locale.bindSelectedSceneObject,
				disabled: !object || !scene || scene.getObjectByProperty("uuid", object.uuid) !== object,
				callback: () => node.graph.transact("bindSceneObject", () =>
				{
					if (node.bindObject(object))
					{
						canvas.setDirty(true, true);
					}
				})
			}];
		});
	}

	attach(script)
	{
		this.script = script;
		this.graphCanvas.setGraph(script.graph);
		this.updateMetadata();
	}

	isAttached(script)
	{
		return this.script === script;
	}

	updateMetadata()
	{
		if (this.script !== null)
		{
			this.setName(this.script.name);
		}
	}

	activate()
	{
		super.activate();
		this.graphCanvas.startRendering();
	}

	deactivate()
	{
		this.graphCanvas.stopRendering();
		super.deactivate();
	}

	updateSize()
	{
		super.updateSize();
		this.canvas.size.copy(this.size);
		this.canvas.updateInterface();
		this.graphCanvas.setDirty(true, true);
	}

	destroy()
	{
		this.removeBindingMenu();
		this.graphCanvas.dispose();
		super.destroy();
	}
}

export {LiteGraphEditor};
