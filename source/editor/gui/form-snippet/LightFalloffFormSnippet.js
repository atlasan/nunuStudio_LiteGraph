import {Locale} from "../../locale/LocaleManager.js";
import {ChangeAction} from "../../history/action/ChangeAction.js";
import {Editor} from "../../Editor.js";
import {NumberBox} from "../../components/input/NumberBox.js";
import {CheckBox} from "../../components/input/CheckBox.js";

/**
 * Form snippet to edit the distance falloff of point and spot lights.
 *
 * Decay is shown as a positive value, lights converted from projects with legacy lighting store it negative to keep the
 * legacy falloff (see LightConverter), the legacy falloff checkbox switches between both.
 *
 * @class LightFalloffFormSnippet
 * @param {TableForm} form Form where the elements are added.
 * @param {Object3D} object Light being edited.
 */
class LightFalloffFormSnippet
{
	constructor(form, object)
	{
		var self = this;

		this.form = form;
		this.object = object;

		// Decay
		this.form.addText(Locale.decay);
		this.decay = new NumberBox(this.form);
		this.decay.size.set(60, 18);
		this.decay.setStep(0.1);
		this.decay.setRange(0, Number.MAX_SAFE_INTEGER);
		this.decay.setOnChange(function()
		{
			var sign = self.object.decay < 0 ? -1 : 1;
			Editor.addAction(new ChangeAction(self.object, "decay", sign * self.decay.getValue()));
		});
		this.form.add(this.decay);
		this.form.nextRow();

		// Legacy falloff
		this.legacy = new CheckBox(this.form);
		this.form.addText(Locale.legacyFalloff);
		this.legacy.size.set(18, 18);
		this.legacy.setOnChange(function()
		{
			var sign = self.legacy.getValue() ? -1 : 1;
			Editor.addAction(new ChangeAction(self.object, "decay", sign * Math.abs(self.object.decay)));
		});
		this.form.add(this.legacy);
		this.form.nextRow();
	}

	/**
	 * Show the values of a light.
	 *
	 * @method attach
	 * @param {Object3D} object Light being edited.
	 */
	attach(object)
	{
		this.object = object;
		this.decay.setValue(Math.abs(object.decay));
		this.legacy.setValue(object.decay < 0);
	}
}

export {LightFalloffFormSnippet};
