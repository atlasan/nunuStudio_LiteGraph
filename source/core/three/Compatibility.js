import * as THREE from "three";

/**
 * Compatibility with names removed from three.js that existing projects and scripts still use.
 *
 * Built from the three.js exports: every XGeometry class is also known by its old XBufferGeometry name.
 *
 * @class Compatibility
 */
var Compatibility = {};

/**
 * Old type name to current three.js export name, e.g. {SphereBufferGeometry: "SphereGeometry"}.
 *
 * @static
 * @attribute renamed
 * @type {Object}
 */
Compatibility.renamed = {Math: "MathUtils"};

for (var name of Object.keys(THREE))
{
	var old = name.replace(/Geometry$/, "BufferGeometry");
	if (old !== name && !(old in THREE))
	{
		Compatibility.renamed[old] = name;
	}
}

/**
 * Old names bound to their current three.js values, to be exposed to scripts.
 *
 * @static
 * @attribute aliases
 * @type {Object}
 */
Compatibility.aliases = {};

for (var old in Compatibility.renamed)
{
	Compatibility.aliases[old] = THREE[Compatibility.renamed[old]];
}

/**
 * Get the current three.js type name for a (possibly removed) type name.
 *
 * @static
 * @method getTypeName
 * @param {string} type Type name, e.g. "SphereBufferGeometry".
 * @return {string} Current type name, e.g. "SphereGeometry".
 */
Compatibility.getTypeName = function(type)
{
	return Compatibility.renamed[type] !== undefined ? Compatibility.renamed[type] : type;
};

/**
 * Methods removed from three.js that user scripts still call, kept as aliases that warn once.
 *
 * @static
 * @attribute methods
 * @type {Array}
 */
Compatibility.methods = [
	[THREE.Object3D, "applyMatrix", function(matrix) { return this.applyMatrix4(matrix); }],
	[THREE.BufferGeometry, "applyMatrix", function(matrix) { return this.applyMatrix4(matrix); }],
	[THREE.Matrix4, "getInverse", function(matrix) { return this.copy(matrix).invert(); }],
	[THREE.Matrix3, "getInverse", function(matrix) { return this.copy(matrix).invert(); }],
	[THREE.Quaternion, "inverse", function() { return this.invert(); }],
	[THREE.BufferGeometry, "addAttribute", function(name, attribute) { return this.setAttribute(name, attribute); }],
	[THREE.BufferGeometry, "removeAttribute", function(name) { return this.deleteAttribute(name); }],
	[THREE.BufferAttribute, "setDynamic", function(dynamic) { return this.setUsage(dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage); }]
];

Compatibility.methods.forEach(function(entry)
{
	var Class = entry[0], method = entry[1], implementation = entry[2];
	if (Class.prototype[method] === undefined)
	{
		var warned = false;
		Class.prototype[method] = function()
		{
			if (!warned)
			{
				warned = true;
				console.warn("nunuStudio: " + method + "() was removed from three.js, update the code to use the new method.");
			}
			return implementation.apply(this, arguments);
		};
	}
});

// updateRange {offset, count} was replaced by addUpdateRange() and clearUpdateRanges(), still used by libraries built for
// older versions (spine-threejs) and scripts. Setting offset or count sets the equivalent update range (count -1 is the whole buffer).
[THREE.BufferAttribute, THREE.InterleavedBuffer].forEach(function(Class)
{
	if ("updateRange" in Class.prototype)
	{
		return;
	}

	Object.defineProperty(Class.prototype, "updateRange", {
		configurable: true,
		get: function()
		{
			if (this._updateRange === undefined)
			{
				var attribute = this, offset = 0, count = -1;
				var apply = function()
				{
					attribute.clearUpdateRanges();
					if (count !== -1)
					{
						attribute.addUpdateRange(offset, count);
					}
				};

				Object.defineProperty(this, "_updateRange", {value: {
					get offset() { return offset; },
					set offset(value) { offset = value; apply(); },
					get count() { return count; },
					set count(value) { count = value; apply(); }
				}});
			}

			return this._updateRange;
		}
	});
});

var callables = new WeakMap();

/**
 * Get a version of a class that can also be called without new, like the ES5 constructor functions of older versions.
 *
 * Old scripts extend classes with Parent.call(this) and Object.create(Parent.prototype), ES6 classes throw when called.
 * With new (or extends) the class is constructed normally, called as a function the instance properties of a new
 * object are defined on this. The prototype and static members are shared, instanceof works as before.
 *
 * @static
 * @method callable
 * @param {Function} Class ES6 class.
 * @return {Function} Constructor that can be called with or without new.
 */
Compatibility.callable = function(Class)
{
	if (typeof Class !== "function" || !/^class\b/.test(Function.prototype.toString.call(Class)))
	{
		return Class;
	}

	var Callable = callables.get(Class);
	if (Callable === undefined)
	{
		Callable = function()
		{
			if (new.target !== undefined)
			{
				return Reflect.construct(Class, arguments, new.target);
			}

			Object.defineProperties(this, Object.getOwnPropertyDescriptors(Reflect.construct(Class, arguments)));
			return this;
		};
		Callable.prototype = Class.prototype;
		Object.setPrototypeOf(Callable, Class);
		Object.defineProperty(Callable, "name", {value: Class.name});
		callables.set(Class, Callable);
	}

	return Callable;
};

/**
 * Copy an object replacing its classes with callable versions (see callable), used for the script context.
 *
 * @static
 * @method callables
 * @param {Object} object Object with classes (e.g. a module namespace).
 * @return {Object} New object with the callable classes.
 */
Compatibility.callables = function(object)
{
	var result = {};
	for (var key in object)
	{
		result[key] = Compatibility.callable(object[key]);
	}
	return result;
};

export {Compatibility};
