/**
 * Target configuration stores platform specific configurations used when exporting the application to a platform.
 *
 * @class TargetConfig
 */
class TargetConfig
{
	constructor()
	{
		/**
		 * Desktop related export properties.
		 *
		 * @attribute desktop
		 * @type {Object}
		 */
		this.desktop =
		{
			fullscreen: false,
			frame: true,
			resizable: true
		};
	}
}

export {TargetConfig};
