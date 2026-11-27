import {MathUtils as TMath, Euler, Quaternion, Vector3} from "three";
import {EventManager} from "../utils/EventManager.js";

// Temporary values used by setObjectQuaternion
var euler = new Euler();
var quaternion = new Quaternion();
var zee = new Vector3(0, 0, 1);
var offset = new Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -PI/2 around the x-axis

/**
 * Gyroscope object can be used to get the orientation from the device.
 *
 * @class Gyroscope
 * @module Input
 */
class Gyroscope
{
	constructor()
	{
		/**
		 * Alpha rotation.
		 *
		 * @property alpha
		 * @type {number}
		 */
		this.alpha = 0;
	
		/**
		 * Beta rotation.
		 *
		 * @property beta
		 * @type {number}
		 */
		this.beta = 0;

		/**
		 * Gamma rotation.
		 *
		 * @property gamma
		 * @type {number}
		 */
		this.gamma = 0;

		/**
		 * Device orientation.
		 *
		 * @property orientation
		 * @type {number}
		 */
		this.orientation = 0;

		this.events = new EventManager();

		var self = this;

		// Orientation
		this.events.add(window, "orientationchange", function(event)
		{
			self.orientation = TMath.degToRad(window.orientation);
		});

		// Device orientation
		this.events.add(window, "deviceorientation", function(event)
		{
			self.alpha = TMath.degToRad(event.alpha);
			self.beta = TMath.degToRad(event.beta);
			self.gamma = TMath.degToRad(event.gamma);
		});

		// Initialize events
		this.events.create();
	}

	/**
	 * Dispose the gyroscope controller.
	 *
	 * Cleans all events created by this controller.
	 * 
	 * @method dispose
	 */
	dispose()
	{
		this.events.destroy();
	}

	/**
	 * Sets a object rotation to match the device orientation.
	 * 
	 * The angles alpha, beta and gamma form a set of intrinsic Tait-Bryan angles of type ZXY
	 *
	 * @method setObjectQuaternion
	 * @param {Object3D} object Object to oriented.
	 */
	setObjectQuaternion(object)
	{
		euler.set(this.beta, this.alpha, -this.gamma, "YXZ"); // "ZXY" for the device, but "YXZ" for us
		object.quaternion.setFromEuler(euler); // Orient the device
		object.quaternion.multiply(offset); // Camera looks out the back of the device, not the top
		object.quaternion.multiply(quaternion.setFromAxisAngle(zee, -this.orientation)); // Adjust for screen orientation
	}
}

export {Gyroscope};
