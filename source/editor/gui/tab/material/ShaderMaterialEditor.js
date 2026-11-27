import {PerspectiveCamera, Scene, Object3D, PointLight, AmbientLight, Mesh, FrontSide, BackSide, DoubleSide, NoBlending, NormalBlending, AdditiveBlending, SubtractiveBlending, MultiplyBlending} from "three";
import {Locale} from "../../../locale/LocaleManager.js";
import {Sky} from "../../../../core/objects/misc/Sky.js";
import {Mouse} from "../../../../core/input/Mouse.js";
import {ChangeAction} from "../../../history/action/ChangeAction.js";
import {CodeEditor} from "../code/CodeEditor.js";
import {Global} from "../../../Global.js";
import {Editor} from "../../../Editor.js";
import {TabGroup} from "../../../components/tabs/TabGroup.js";
import {TabComponent} from "../../../components/tabs/TabComponent.js";
import {TableForm} from "../../../components/TableForm.js";
import {RendererCanvas} from "../../../components/RendererCanvas.js";
import {TextBox} from "../../../components/input/TextBox.js";
import {DropdownList} from "../../../components/input/DropdownList.js";
import {CheckBox} from "../../../components/input/CheckBox.js";
import {DualDivision} from "../../../components/containers/DualDivision.js";
import {DualContainer} from "../../../components/containers/DualContainer.js";
import {MaterialEditor} from "./MaterialEditor.js";

class ShaderMaterialEditor extends MaterialEditor 
{
	constructor(parent, closeable, container, index) 
	{
	// static-check: allow-no-super (built without calling super(), keeping the original ES5 semantics)
		var self = Reflect.construct(TabComponent, [parent, closeable, container, index, Locale.material, Global.FILE_PATH + "icons/misc/material.png"], new.target);


		// Preview configuration
		self.previewForm = new TableForm();
		self.previewForm.setAutoSize(false);
		self.previewForm.addText(Locale.configuration);
		self.previewForm.nextRow();
	
		// Canvas
		self.canvas = new RendererCanvas();
		self.canvas.setOnResize(function(x, y)
		{
			self.camera.aspect = x / y;
			self.camera.updateProjectionMatrix();
		});

		// Mouse
		self.mouse = new Mouse(window, true);
		self.mouse.setCanvas(self.canvas.element);

		// Preview division
		self.preview = new DualContainer();
		self.preview.orientation = DualDivision.VERTICAL;
		self.preview.tabPosition = 0.8;
		self.preview.tabPositionMin = 0.05;
		self.preview.tabPositionMax = 0.95;
		self.preview.attachA(self.canvas);
		self.preview.attachB(self.previewForm);

		// Tab container
		self.tab = new TabGroup();
		self.tab.element.style.backgroundColor = "var(--bar-color)";
		self.tab.buttonSize.set(150, 25);

		// Main container
		self.main = new DualContainer(self);
		self.main.tabPosition = 0.5;
		self.main.tabPositionMin = 0.05;
		self.main.tabPositionMax = 0.95;
		self.main.attachA(self.preview);
		self.main.attachB(self.tab);

		// Material UI File element
		self.asset = null;

		// Attached material
		self.material = null;

		// Material camera
		self.camera = new PerspectiveCamera(80, self.canvas.size.x/self.canvas.size.y);
		self.camera.position.set(0, 0, 2.5);
	
		// Scene
		self.scene = new Scene();
	
		// Interactive object
		self.interactive = new Object3D();
		self.scene.add(self.interactive);
	
		// Scene
		self.sky = new Sky();
		self.sky.visible = false;
		self.scene.add(self.sky);

		self.pointLight = new PointLight(0x777777);
		self.pointLight.position.set(-3, 0, 3);
		self.pointLight.visible = false;
		self.scene.add(self.pointLight);
	
		self.ambientLight = new AmbientLight(0x555555);
		self.ambientLight.visible = false;
		self.scene.add(self.ambientLight);

		// Mesh
		self.mesh = new Mesh(MaterialEditor.geometries[0][1], null);
		self.interactive.add(self.mesh);
	
		// Test model
		self.previewForm.addText(Locale.geometry);
		self.testModel = new DropdownList(self.previewForm);
		self.testModel.size.set(100, 18);
		for (var i = 0; i < MaterialEditor.geometries.length; i++)
		{
			self.testModel.addValue(MaterialEditor.geometries[i][0], i);
		}
		self.testModel.setOnChange(function()
		{
			var value = self.testModel.getSelectedIndex();
			self.mesh.geometry = MaterialEditor.geometries[value][1];
		});
		self.previewForm.add(self.testModel);
		self.previewForm.nextRow();

		// Sky
		self.previewForm.addText(Locale.sky);
		self.skyEnabled = new CheckBox(self.previewForm);
		self.skyEnabled.size.set(18, 18);
		self.skyEnabled.setValue(self.sky.visible);
		self.skyEnabled.setOnChange(function()
		{
			self.sky.visible = self.skyEnabled.getValue();
		});
		self.previewForm.add(self.skyEnabled);
		self.previewForm.nextRow();

		// Point Light
		self.previewForm.addText(Locale.pointLight);
		self.lightEnabled = new CheckBox(self.previewForm);
		self.lightEnabled.size.set(18, 18);
		self.lightEnabled.setValue(self.pointLight.visible);
		self.lightEnabled.setOnChange(function()
		{
			self.pointLight.visible = self.lightEnabled.getValue();
		});
		self.previewForm.add(self.lightEnabled);
		self.previewForm.nextRow();

		// Ambient Light
		self.previewForm.addText(Locale.ambientLight);
		self.ambientLightEnabled = new CheckBox(self.previewForm);
		self.ambientLightEnabled.size.set(18, 18);
		self.ambientLightEnabled.setValue(self.ambientLight.visible);
		self.ambientLightEnabled.setOnChange(function()
		{
			self.ambientLight.visible = self.ambientLightEnabled.getValue();
		});
		self.previewForm.add(self.ambientLightEnabled);
		self.previewForm.nextRow();

		// General
		self.general = self.tab.addTab(TabComponent, false);
		self.general.setIcon(Global.FILE_PATH + "icons/misc/material.png");
		self.general.setName(Locale.material);

		self.form = new TableForm(self.general);
		self.form.setAutoSize(false);

		// Name
		self.form.addText(Locale.name);
		self.name = new TextBox(self.form);
		self.name.size.set(200, 18);
		self.name.setOnChange(function()
		{
			Editor.addAction(new ChangeAction(self.material, "name", self.name.getText()));
			Editor.updateObjectsViewsGUI();
		});
		self.form.add(self.name);
		self.form.nextRow();

		// Side
		self.form.addText(Locale.side);
		self.side = new DropdownList(self.form);
		self.side.position.set(100, 85);
		self.side.size.set(150, 18);
		self.side.addValue(Locale.front, FrontSide);
		self.side.addValue(Locale.back, BackSide);
		self.side.addValue(Locale.double, DoubleSide);
		self.side.setOnChange(function()
		{
			Editor.addAction(new ChangeAction(self.material, "side", self.side.getValue()));
			self.material.needsUpdate = true;
		});
		self.form.add(self.side);
		self.form.nextRow();

		// Test depth
		self.form.addText(Locale.depthTest);
		self.depthTest = new CheckBox(self.form);
		self.depthTest.size.set(18, 18);
		self.depthTest.setOnChange(function()
		{
			Editor.addAction(new ChangeAction(self.material, "depthTest", self.depthTest.getValue()));
			self.material.needsUpdate = true;
		});
		self.form.add(self.depthTest);
		self.form.nextRow();
	
		// Write depth
		self.form.addText(Locale.depthWrite);
		self.depthWrite = new CheckBox(self.form);
		self.depthWrite.size.set(18, 18);
		self.depthWrite.setOnChange(function()
		{
			Editor.addAction(new ChangeAction(self.material, "depthWrite", self.depthWrite.getValue()));
			self.material.needsUpdate = true;
		});
		self.form.add(self.depthWrite);
		self.form.nextRow();

		// Transparent
		self.form.addText(Locale.transparent);
		self.transparent = new CheckBox(self.form);
		self.transparent.size.set(18, 18);
		self.transparent.setOnChange(function()
		{
			Editor.addAction(new ChangeAction(self.material, "transparent", self.transparent.getValue()));
			self.material.needsUpdate = true;
		});
		self.form.add(self.transparent);
		self.form.nextRow();
	
		// Blending mode
		self.form.addText(Locale.blendingMode);
		self.blending = new DropdownList(self.form);
		self.blending.position.set(100, 85);
		self.blending.size.set(100, 18);
		self.blending.addValue(Locale.none, NoBlending);
		self.blending.addValue(Locale.normal, NormalBlending);
		self.blending.addValue(Locale.additive, AdditiveBlending);
		self.blending.addValue(Locale.subtractive, SubtractiveBlending);
		self.blending.addValue(Locale.multiply, MultiplyBlending);
		self.blending.setOnChange(function()
		{
			Editor.addAction(new ChangeAction(self.material, "blending", self.blending.getValue()));
			self.material.needsUpdate = true;
		});
		self.form.add(self.blending);
		self.form.nextRow();

		// Wireframe
		self.form.addText(Locale.wireframe);
		self.wireframe = new CheckBox(self.form);
		self.wireframe.size.set(18, 18);
		self.wireframe.setOnChange(function()
		{
			Editor.addAction(new ChangeAction(self.material, "wireframe", self.wireframe.getValue()));
		});
		self.form.add(self.wireframe);
		self.form.nextRow();

		// Fragment tab
		self.fragmentShader = self.tab.addTab(CodeEditor, false);
		self.fragmentShader.setName(Locale.fragment);
		self.fragmentShader.setLanguage("glsl");
		self.fragmentShader.setOnChange(function()
		{
			Editor.addAction(new ChangeAction(self.material, "fragmentShader", self.fragmentShader.getText()));
			self.material.needsUpdate = true;
		});

		// Vertex tab
		self.vertexShader = self.tab.addTab(CodeEditor, false);
		self.vertexShader.setName(Locale.vertex);
		self.vertexShader.setLanguage("glsl");
		self.vertexShader.setOnChange(function()
		{
			Editor.addAction(new ChangeAction(self.material, "vertexShader", self.vertexShader.getText()));
			self.material.needsUpdate = true;
		});
	
		return self;
	}

	attach(material, asset) 
	{
		this.mesh.material = material;

		if (asset !== undefined)
		{
			this.asset = asset;
		}

		this.material = material;
		this.updateMetadata();

		// Base
		this.name.setText(material.name);
		this.side.setValue(material.side);
		this.depthTest.setValue(material.depthTest);
		this.depthWrite.setValue(material.depthWrite);
		this.transparent.setValue(material.transparent);
		this.blending.setValue(material.blending);	
		this.wireframe.setValue(material.wireframe);

		// Shader
		this.fragmentShader.setText(material.fragmentShader);
		this.vertexShader.setText(material.vertexShader);
	}

	updateSize() 
	{
		TabComponent.prototype.updateSize.call(this);

		this.main.size.copy(this.size);
		this.main.updateInterface();

		this.form.size.copy(this.general.size);
		this.form.updateInterface();
	}

}
export {ShaderMaterialEditor};
