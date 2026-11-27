/**
 * Upgrades Spine skeleton JSON exported for the 3.8 runtimes to the 4.0 format read by spine-core 4.0.
 *
 * The bundled Spine runtime is 4.0, older projects store skeletons exported for 3.8. The formats differ in:
 *  - curves: 3.8 stores a normalized bezier (curve, c2, c3, c4), 4.0 stores absolute points per value [cx1, cy1, cx2, cy2, ...]
 *  - names: rotate key angle is value, slot color/twoColor timelines are rgba/rgba2,
 *    transform and path constraint mixes are mixRotate, mixX, mixY, mixScaleX, mixScaleY, mixShearY
 *
 * @class SpineJson
 * @static
 */
var SpineJson = {};

/**
 * Check if skeleton data was exported for a 3.x runtime.
 *
 * @static
 * @method isLegacy
 * @param {Object} json Skeleton data.
 * @return {boolean} True if the data needs to be upgraded.
 */
SpineJson.isLegacy = function(json)
{
	var version = json.skeleton !== undefined && json.skeleton.spine !== undefined ? String(json.skeleton.spine) : "";
	return version.startsWith("3.");
};

/**
 * Upgrade 3.8 skeleton data to the 4.0 format, data for other versions is returned unchanged.
 *
 * The data passed is not modified.
 *
 * @static
 * @method upgrade
 * @param {Object|string} json Skeleton data, as an object or JSON text.
 * @return {Object|string} Skeleton data in the 4.0 format.
 */
SpineJson.upgrade = function(json)
{
	var data = typeof json === "string" ? JSON.parse(json) : json;
	if (!SpineJson.isLegacy(data))
	{
		return json;
	}

	data = JSON.parse(JSON.stringify(data));

	// Constraint definitions
	(data.transform || []).forEach(function(constraint)
	{
		renameMixes(constraint);
	});
	(data.path || []).forEach(function(constraint)
	{
		renameMixes(constraint);
	});

	for (var name in data.animations)
	{
		upgradeAnimation(data.animations[name]);
	}

	data.skeleton.spine = "4.0.0-upgraded-" + data.skeleton.spine;
	return data;
};

// 3.8 constraint mix names to the 4.0 ones
function renameMixes(map)
{
	if (map.rotateMix !== undefined) {map.mixRotate = map.rotateMix; delete map.rotateMix;}
	if (map.translateMix !== undefined) {map.mixX = map.mixY = map.translateMix; delete map.translateMix;}
	if (map.scaleMix !== undefined) {map.mixScaleX = map.mixScaleY = map.scaleMix; delete map.scaleMix;}
	if (map.shearMix !== undefined) {map.mixShearY = map.shearMix; delete map.shearMix;}
}

// Color "rrggbbaa" to [r, g, b, a] in 0..1
function color(hex, alpha)
{
	var values = [];
	for (var i = 0; i < (alpha ? 8 : 6); i += 2)
	{
		values.push(parseInt(hex.substr(i, 2), 16) / 255);
	}
	return values;
}

/**
 * Convert the curves of a timeline, values(key) returns the animated values of a key (with the 3.8 defaults).
 *
 * 3.8 curve between key i and i + 1: x = time, y = value, control points (c1, c2) and (c3, c4) normalized in [0, 1].
 * 4.0 curve: per value, absolute control points [cx1, cy1, cx2, cy2].
 */
function convertCurves(keys, values, percent)
{
	for (var i = 0; i < keys.length; i++)
	{
		var key = keys[i];
		var next = keys[i + 1];
		var curve = key.curve;

		if (Array.isArray(curve) || curve === "stepped")
		{
			continue;
		}
		if (curve === undefined || next === undefined)
		{
			delete key.curve;
			continue;
		}

		var c1 = curve;
		var c2 = key._c2 !== undefined ? key._c2 : 0;
		var c3 = key._c3 !== undefined ? key._c3 : 1;
		var c4 = key._c4 !== undefined ? key._c4 : 1;

		var t0 = key.time || 0, t1 = next.time || 0;
		// Deform curves are on the interpolation percentage, from 0 to 1
		var v0 = percent ? [0] : values(key), v1 = percent ? [1] : values(next);
		var points = [];
		for (var v = 0; v < v0.length; v++)
		{
			points.push(t0 + c1 * (t1 - t0), v0[v] + c2 * (v1[v] - v0[v]), t0 + c3 * (t1 - t0), v0[v] + c4 * (v1[v] - v0[v]));
		}
		key.curve = points;
	}

	keys.forEach(function(key)
	{
		delete key.c2;
		delete key.c3;
		delete key.c4;
		delete key._c2;
		delete key._c3;
		delete key._c4;
	});
}

// Keep the normalized control points before the keys are modified
function prepare(keys)
{
	keys.forEach(function(key)
	{
		key._c2 = key.c2;
		key._c3 = key.c3;
		key._c4 = key.c4;
	});
	return keys;
}

function upgradeAnimation(animation)
{
	var name, timeline;

	// Bones
	for (name in animation.bones)
	{
		var bone = animation.bones[name];
		if (bone.rotate)
		{
			prepare(bone.rotate).forEach(function(key)
			{
				if (key.angle !== undefined) {key.value = key.angle; delete key.angle;}
			});
			convertCurves(bone.rotate, function(key) { return [key.value || 0]; });
		}
		if (bone.translate) {convertCurves(prepare(bone.translate), function(key) { return [key.x || 0, key.y || 0]; });}
		if (bone.shear) {convertCurves(prepare(bone.shear), function(key) { return [key.x || 0, key.y || 0]; });}
		if (bone.scale)
		{
			convertCurves(prepare(bone.scale), function(key) { return [key.x !== undefined ? key.x : 1, key.y !== undefined ? key.y : 1]; });
		}
	}

	// Slots
	for (name in animation.slots)
	{
		var slot = animation.slots[name];
		if (slot.color)
		{
			slot.rgba = slot.color;
			delete slot.color;
			convertCurves(prepare(slot.rgba), function(key) { return color(key.color || "ffffffff", true); });
		}
		if (slot.twoColor)
		{
			slot.rgba2 = slot.twoColor;
			delete slot.twoColor;
			convertCurves(prepare(slot.rgba2), function(key) { return color(key.light || "ffffffff", true).concat(color(key.dark || "000000", false)); });
		}
	}

	// IK constraints
	for (name in animation.ik)
	{
		convertCurves(prepare(animation.ik[name]), function(key) { return [key.mix !== undefined ? key.mix : 1, key.softness || 0]; });
	}

	// Transform constraints
	for (name in animation.transform)
	{
		timeline = prepare(animation.transform[name]);
		timeline.forEach(renameMixes);
		convertCurves(timeline, function(key)
		{
			var rotate = key.mixRotate !== undefined ? key.mixRotate : 1, x = key.mixX !== undefined ? key.mixX : 1;
			var scale = key.mixScaleX !== undefined ? key.mixScaleX : 1, shear = key.mixShearY !== undefined ? key.mixShearY : 1;
			return [rotate, x, x, scale, scale, shear];
		});
	}

	// Path constraints
	for (name in animation.path)
	{
		var path = animation.path[name];
		if (path.position) {convertCurves(prepare(path.position), function(key) { return [key.position || 0]; });}
		if (path.spacing) {convertCurves(prepare(path.spacing), function(key) { return [key.spacing || 0]; });}
		if (path.mix)
		{
			prepare(path.mix).forEach(renameMixes);
			convertCurves(path.mix, function(key)
			{
				var x = key.mixX !== undefined ? key.mixX : 1;
				return [key.mixRotate !== undefined ? key.mixRotate : 1, x, x];
			});
		}
	}

	// Deform, the curve is on the interpolation percentage
	for (var skin in animation.deform)
	{
		for (var slotName in animation.deform[skin])
		{
			for (var attachment in animation.deform[skin][slotName])
			{
				convertCurves(prepare(animation.deform[skin][slotName][attachment]), null, true);
			}
		}
	}
}

export {SpineJson};
