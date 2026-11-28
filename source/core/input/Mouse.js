import {Vector2} from "three";
import {EventManager} from "../utils/EventManager.js";
import {Key} from "./Key.js";

/**
 * Mouse instance for sync input the mouse should be updated everytime before.
 *
 * Automatically calculates the diff of position between frames.
 * 
 * The mouse object provided by scripts is automatically updated by the runtime handler.
 * 
 * @class Mouse
 * @module Input
 * @param {Component} domElement DOM element to craete the mouse events.
 * @param {boolean} dontInitialize If true the mouse events are not created.
 */
class Mouse
{
	constructor(domElement, dontInitialize)
	{
		// Raw data
		this._keys = new Array(5);
		this._position = new Vector2(0, 0);
		this._positionUpdated = false;
		this._delta = new Vector2(0, 0);
		this._wheel = 0;
		this._wheelUpdated = false;
		this._doubleClicked = new Array(5);
		this.inputTarget = null;

		/**
		 * Array with mouse buttons status.
		 *
		 * @type {array}
		 * @property keys
		 */
		this.keys = new Array(5);

		/**
		 * Mouse position inside of the window (coordinates in window space).
		 *
		 * @type {Vector2}
		 * @property position
		 */
		this.position = new Vector2(0, 0);

		/**
		 * Mouse movement (coordinates in window space).
		 *
		 * @type {Vector2}
		 * @property delta
		 */
		this.delta = new Vector2(0, 0);

		/**
		 * Mouse scroll wheel movement.
		 *
		 * @type {number}
		 * @property wheel
		 */
		this.wheel = 0;
	
		/**
		 * Indicates a button of the mouse was double clicked.
		 *
		 * @type {Array}
		 * @property doubleClicked
		 */
		this.doubleClicked = new Array(5);

		/**
		 * DOM element where to attach the mouse events.
		 *
		 * @property domElement
		 * @type {Element}
		 */
		this.domElement = domElement !== undefined ? domElement : window;

		/**
		 * Canvas attached to this mouse instance used to calculate position and delta in element space coordinates.
		 *
		 * @type {Element}
		 * @property canvas
		 */
		this.canvas = null;
	
		/**
		 * Event manager responsible for updating the raw data variables.
		 *
		 * Diferent events are used depending on the host platform.
		 *
		 * When the update method is called the raw data is reset.
		 *
		 * @property events
		 * @type {EventManager} 
		 */
		this.events = new EventManager();

		// Initialize key instances
		for (var i = 0; i < 5; i++)
		{
			this._doubleClicked[i] = false;
			this.doubleClicked[i] = false;
			this._keys[i] = new Key();
			this.keys[i] = new Key();
		}

		// Self pointer
		var self = this;

		const accepts = (event) => this.inputTarget === null || event.target === this.inputTarget;
		this.events.add(this.domElement, "wheel", (event) =>
		{
			if (accepts(event))
			{
				this._wheel += event.deltaY;
				this._wheelUpdated = true;
			}
		});
		this.events.add(window, "blur", () => this.reset());

		// Touchscreen input events
		if ('ontouchstart' in window || navigator.msMaxTouchPoints > 0)
		{
			// Auxiliar variables to calculate touch delta
			var lastTouch = new Vector2(0, 0);

			// Touch start event
			this.events.add(this.domElement, "touchstart", function(event)
			{
				var touch = event.touches[0];

				self.updatePosition(touch.screenX, touch.screenY, 0, 0);
				self.updateKey(Mouse.LEFT, Key.DOWN);

				lastTouch.set(touch.screenX, touch.screenY);
			});

			// Touch end event
			this.events.add(this.domElement, "touchend", function(event)
			{
				self.updateKey(Mouse.LEFT, Key.UP);
			});

			// Touch cancel event
			this.events.add(this.domElement, "touchcancel", function(event)
			{
				self.updateKey(Mouse.LEFT, Key.UP);
			});

			// Touch move event
			this.events.add(document.body, "touchmove", function(event)
			{
				var touch = event.touches[0];
				self.updatePosition(touch.screenX, touch.screenY, touch.screenX - lastTouch.x, touch.screenY - lastTouch.y);
				lastTouch.set(touch.screenX, touch.screenY);
			});
		}

		// Move
		this.events.add(this.domElement, "mousemove", function(event)
		{
			// console.log("nunuStudio: Mouse move event", event.offsetX, event.offsetY);

			if (accepts(event))
			{
				self.updatePosition(event.clientX, event.clientY, event.movementX, event.movementY);
			}
		});

		// Button pressed
		this.events.add(this.domElement, "mousedown", function(event)
		{
			if (accepts(event))
			{
				self.updatePosition(event.clientX, event.clientY, 0, 0);
				self.updateKey(event.button, Key.DOWN);
			}
		});

		// Button released
		this.events.add(this.domElement, "mouseup", function(event)
		{
			if (accepts(event))
			{
				self.updatePosition(event.clientX, event.clientY, 0, 0);
			}
			self.updateKey(event.button, Key.UP);
		});

		// Drag start
		this.events.add(this.domElement, "dragstart", function(event)
		{
			self.updateKey(event.button, Key.UP);
		});

		// Mouse double click
		this.events.add(this.domElement, "dblclick", function(event)
		{	
			if (accepts(event) && event.button >= 0 && event.button < self.keys.length)
			{
				self._doubleClicked[event.button] = true;
			}
		});

		if (dontInitialize !== true)
		{
			this.create();
		}
	}

	/**
	 * Element to be used to calculate coordinates relative to that canvas.
	 * 
	 * @method setCanvas
	 * @param {Component} canvas Canvas to be attached to the Mouse instance
	 */
	setCanvas(canvas)
	{
		if (canvas === this.canvas)
		{
			return;
		}
		if (this.canvas !== null)
		{
			this.canvas.removeEventListener("mouseenter", Mouse.enterCanvas);
			this.canvas.removeEventListener("mouseleave", Mouse.leaveCanvas);
		}
		this.canvas = canvas;
		if (canvas !== null)
		{
			this.watchCanvas();
		}
	}

	watchCanvas()
	{
		const canvas = this.canvas;
		canvas.pointerInside = canvas.matches(":hover");
		canvas.addEventListener("mouseenter", Mouse.enterCanvas);
		canvas.addEventListener("mouseleave", Mouse.leaveCanvas);
	}

	static enterCanvas() {this.pointerInside = true;}
	static leaveCanvas() {this.pointerInside = false;}

	/**
	 * Check if mouse is inside attached canvas (updated async).
	 * 
	 * @method insideCanvas
	 * @return {boolean} True if mouse is currently inside the canvas
	 */
	insideCanvas()
	{
		return this.canvas !== null && this.canvas.pointerInside;
	}

	/**
	 * Set mouse lock, if true mouse lock will be request, if false the mouse will be released.
	 * 
	 * @method setLock
	 * @param {boolean} value If true pointer lock will be requested for the canvas attached to the Mouse instance
	 */
	setLock(value)
	{
		if (this.canvas !== null)
		{
			if (value)
			{
				this.canvas.requestPointerLock = this.canvas.requestPointerLock || this.canvas.mozRequestPointerLock || this.canvas.webkitRequestPointerLock;
				if (this.canvas.requestPointerLock !== undefined)
				{
					this.canvas.requestPointerLock();
				}
			}
			else
			{
				if (document.exitPointerLock !== undefined)
				{
					document.exitPointerLock();
				}
				else if (document.mozExitPointerLock !== undefined)
				{
					document.mozExitPointerLock();
				}
				else if (document.webkitExitPointerLock !== undefined)
				{
					document.webkitExitPointerLock();
				}
			}
		}
	}

	/**
	 * Check if mouse button is currently pressed.
	 * 
	 * @method buttonPressed
	 * @param {number} button Button to check status of
	 * @return {boolean} True if button is currently pressed
	 */
	buttonPressed(button)
	{
		return this.keys[button].pressed;
	}

	/**
	 * Check if Mouse button was double clicked.
	 * 
	 * @method buttonDoubleClicked
	 * @param {number} button Button to check status of
	 * @return {boolean} True if some mouse button was just double clicked
	 */
	buttonDoubleClicked(button)
	{
		return this.doubleClicked[button];
	}

	/**
	 * Check if a mouse button was just pressed.
	 * 
	 * @method buttonJustPressed
	 * @param {number} button Button to check status of
	 * @return {boolean} True if button was just pressed
	 */
	buttonJustPressed(button)
	{
		return this.keys[button].justPressed;
	}

	/**
	 * Check if a mouse button was just released.
	 * 
	 * @method buttonJustReleased
	 * @param {number} button Button to check status of
	 * @return {boolean} True if button was just released
	 */
	buttonJustReleased(button)
	{
		return this.keys[button].justReleased;
	}

	/**
	 * Update mouse position.
	 * 
	 * @method updatePosition
	 * @param {number} x
	 * @param {number} y
	 * @param {number} xDiff
	 * @param {number} yDiff
	 */
	updatePosition(x, y, xDiff, yDiff)
	{
		if (this.canvas !== null)
		{
			var rect = this.canvas.getBoundingClientRect();
			x -= rect.left;
			y -= rect.top;
		}

		this._position.set(x, y);
		this._delta.x += xDiff;
		this._delta.y += yDiff;
		this._positionUpdated = true;
	}

	/**
	 * Update a mouse button.
	 *
	 * @method updateKey
	 * @param {number} button
	 * @param {number} action
	 */
	updateKey(button, action)
	{
		const key = this._keys[button];
		if (key)
		{
			const down = action === Key.DOWN;
			key.set(key.justPressed || (down && !key.pressed), down,
				key.justReleased || (!down && key.pressed));
		}
	}

	/**
	 * Update mouse buttons state, position, wheel and delta synchronously.
	 * 
	 * @method update
	 */
	update()
	{
		// Update mouse keys state
		for (var i = 0; i < 5; i++)
		{
			const key = this._keys[i];
			this.keys[i].set(key.justPressed, key.pressed, key.justReleased);
			key.update(Key.RESET);

			// Update mouse double click
			if (this._doubleClicked[i] === true)
			{
				this.doubleClicked[i] = true;
				this._doubleClicked[i] = false;
			}
			else
			{
				this.doubleClicked[i] = false;
			}
		}

		// Update mouse wheel
		if (this._wheelUpdated)
		{
			this.wheel = this._wheel;
			this._wheel = 0;
			this._wheelUpdated = false;
		}
		else
		{
			this.wheel = 0;
		}

		// Update mouse Position if needed
		if (this._positionUpdated)
		{
			this.delta.copy(this._delta);
			this.position.copy(this._position);

			this._delta.set(0, 0);
			this._positionUpdated = false;
		}
		else
		{
			this.delta.x = 0;
			this.delta.y = 0;
		}
	}

	/**
	 * Create mouse events.
	 * 
	 * @method create
	 */
	create()
	{
		this.events.create();
		if (this.canvas) {this.watchCanvas();}
	}

	reset()
	{
		this.keys.forEach((key) => key.reset());
		this._keys.forEach((key) => key.reset());
		this.doubleClicked.fill(false);
		this._doubleClicked.fill(false);
		this.wheel = this._wheel = 0;
		this._wheelUpdated = this._positionUpdated = false;
		this.delta.set(0, 0);
		this._delta.set(0, 0);
	}

	/**
	 * Dispose mouse events.
	 * 
	 * @method dispose
	 */
	dispose()
	{
		this.events.destroy();
		if (this.canvas)
		{
			this.canvas.removeEventListener("mouseenter", Mouse.enterCanvas);
			this.canvas.removeEventListener("mouseleave", Mouse.leaveCanvas);
		}
		this.reset();
	}
}

/**
 * Left mouse button.
 *
 * @attribute LEFT
 * @type {number}
 */
Mouse.LEFT = 0;

/**
 * Middle mouse button.
 *
 * @attribute MIDDLE
 * @type {number}
 */
Mouse.MIDDLE = 1;

/**
 * Right mouse button.
 *
 * @attribute RIGHT
 * @type {number}
 */
Mouse.RIGHT = 2;

/**
 * Back mouse navigation button.
 *
 * @attribute BACK
 * @type {number}
 */
Mouse.BACK = 3;

/**
 * Forward mouse navigation button.
 *
 * @attribute FORWARD
 * @type {number}
 */
Mouse.FORWARD = 4;

// Values set on Mouse are also read from instances (e.g. Mouse.A in scripts)
for (var key of Object.keys(Mouse))
{
	if (!(key in Mouse.prototype))
	{
		Mouse.prototype[key] = Mouse[key];
	}
}

export {Mouse};
