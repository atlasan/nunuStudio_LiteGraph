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
	[THREE.Matrix3, "getInverse", function(matrix) { return this.copy(matrix).invert(); }]
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

export {Compatibility};
