import {ShaderChunk} from "three";

/**
 * Converts lights between the legacy lighting of three.js r154 and older (nunuStudio projects) and physically based lighting.
 *
 * Legacy lighting did things that were removed or changed in three.js:
 *  - the intensity of ambient, directional, hemisphere, point and spot lights was multiplied by PI
 *  - point and spot lights used a linear falloff, pow(1 - distance / cutoff, decay), or no falloff when distance or decay was 0
 *  - environment maps (cube and equirectangular) only added reflections, three.js now also lights materials with them (diffuse)
 *
 * toPhysical() reproduces these: intensities are multiplied by PI, lights without falloff get decay 0 (same result),
 * distance limited lights are marked with a negative decay, drawn with the legacy falloff by a shader patch,
 * and materials with an environment map are marked to keep reflections only (see setLegacyEnvMap).
 *
 * Loaded programs saved with legacy lighting are converted automatically (see convertProgram).
 *
 * @class LightConverter
 * @static
 */
var LightConverter = {};

/**
 * Factor applied to light intensities by the legacy lighting.
 *
 * @static
 * @attribute LEGACY_SCALE
 * @type {number}
 */
LightConverter.LEGACY_SCALE = Math.PI;

/**
 * Check if a light had its intensity scaled by the legacy lighting.
 *
 * Light probes and rect area lights were not scaled.
 *
 * @static
 * @method isScaled
 * @param {Object3D} light Light to check.
 * @return {boolean} True if the light intensity was scaled.
 */
LightConverter.isScaled = function(light)
{
	return light.isAmbientLight === true || light.isDirectionalLight === true || light.isHemisphereLight === true || light.isPointLight === true || light.isSpotLight === true;
};

/**
 * Check if a light is drawn with the legacy distance falloff (negative decay).
 *
 * @static
 * @method hasLegacyFalloff
 * @param {Object3D} light Light to check.
 * @return {boolean} True if the light uses the legacy falloff.
 */
LightConverter.hasLegacyFalloff = function(light)
{
	return light.decay !== undefined && light.decay < 0;
};

/**
 * Convert lights set up for legacy lighting to physical lighting, the result looks the same.
 *
 * Locked lights are skipped (they belong to objects that create them in code, like Sky).
 *
 * @static
 * @method toPhysical
 * @param {Object3D} object Light or object that contains lights.
 * @return {number} Number of converted lights.
 */
LightConverter.toPhysical = function(object)
{
	var count = 0;

	object.traverse(function(light)
	{
		if ((light !== object && light.locked === true) || !LightConverter.isScaled(light))
		{
			return;
		}

		light.intensity *= LightConverter.LEGACY_SCALE;

		if (light.decay !== undefined && !LightConverter.hasLegacyFalloff(light))
		{
			if (light.distance === 0 || light.decay === 0)
			{
				// No falloff, the physical attenuation with decay 0 and no cutoff is constant
				light.distance = 0;
				light.decay = 0;
			}
			else
			{
				light.decay = -light.decay;
			}
		}

		count++;
	});

	return count;
};

/**
 * Convert a light created with legacy values and return it, e.g. scene.add(LightConverter.fromLegacy(new PointLight(0x444444))).
 *
 * @static
 * @method fromLegacy
 * @param {Object3D} light Light with legacy values.
 * @return {Object3D} The same light, converted to physical values.
 */
LightConverter.fromLegacy = function(light)
{
	LightConverter.toPhysical(light);
	return light;
};

/**
 * Material define that keeps environment maps to reflections only, like three.js r154 and older did for these maps.
 *
 * @static
 * @attribute LEGACY_ENVMAP
 * @type {string}
 */
LightConverter.LEGACY_ENVMAP = "LEGACY_ENVMAP_LIGHTING";

/**
 * Check if a material keeps its environment map to reflections only.
 *
 * @static
 * @method usesLegacyEnvMap
 * @param {Material} material Material to check.
 * @return {boolean} True if the material uses the legacy environment map lighting.
 */
LightConverter.usesLegacyEnvMap = function(material)
{
	return material.defines !== undefined && material.defines[LightConverter.LEGACY_ENVMAP] !== undefined;
};

/**
 * Set if a material environment map only adds reflections (legacy) or also lights the material (three.js now).
 *
 * @static
 * @method setLegacyEnvMap
 * @param {Material} material Material to change.
 * @param {boolean} enabled True to keep reflections only.
 */
LightConverter.setLegacyEnvMap = function(material, enabled)
{
	if (enabled === LightConverter.usesLegacyEnvMap(material))
	{
		return;
	}

	if (enabled)
	{
		material.defines = Object.assign({}, material.defines);
		material.defines[LightConverter.LEGACY_ENVMAP] = "";
	}
	else
	{
		delete material.defines[LightConverter.LEGACY_ENVMAP];
	}

	material.needsUpdate = true;
};

/**
 * Mark the materials of an object that have an environment map to keep the legacy environment map lighting.
 *
 * @static
 * @method keepLegacyEnvMaps
 * @param {Object3D} object Object to traverse.
 * @return {number} Number of marked materials.
 */
LightConverter.keepLegacyEnvMaps = function(object)
{
	var count = 0;

	object.traverse(function(child)
	{
		var materials = Array.isArray(child.material) ? child.material : child.material !== undefined ? [child.material] : [];
		for (var i = 0; i < materials.length; i++)
		{
			var material = materials[i];
			if (material.envMap && (material.isMeshStandardMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial) && !LightConverter.usesLegacyEnvMap(material))
			{
				LightConverter.setLegacyEnvMap(material, true);
				count++;
			}
		}
	});

	return count;
};

/**
 * Convert lights from physical lighting back to the legacy values (inverse of toPhysical).
 *
 * @static
 * @method toLegacy
 * @param {Object3D} object Light or object that contains lights.
 * @return {number} Number of converted lights.
 */
LightConverter.toLegacy = function(object)
{
	var count = 0;

	object.traverse(function(light)
	{
		if ((light !== object && light.locked === true) || !LightConverter.isScaled(light))
		{
			return;
		}

		light.intensity /= LightConverter.LEGACY_SCALE;

		if (LightConverter.hasLegacyFalloff(light))
		{
			light.decay = -light.decay;
		}

		count++;
	});

	return count;
};

/**
 * Check if a program was saved with legacy lighting.
 *
 * @static
 * @method isLegacyProgram
 * @param {Program} program Program to check.
 * @return {boolean} True if the program lights use legacy values.
 */
LightConverter.isLegacyProgram = function(program)
{
	return program.rendererConfig !== undefined && program.rendererConfig.physicallyCorrectLights !== true;
};

/**
 * Convert a program saved with legacy lighting to physical lighting, it is then marked as physical.
 *
 * @static
 * @method convertProgram
 * @param {Program} program Program to convert.
 * @return {number} Number of converted lights, 0 if the program already uses physical lighting.
 */
LightConverter.convertProgram = function(program)
{
	if (!LightConverter.isLegacyProgram(program))
	{
		return 0;
	}

	var count = LightConverter.toPhysical(program);
	LightConverter.keepLegacyEnvMaps(program);
	program.rendererConfig.physicallyCorrectLights = true;
	return count;
};

// Draw lights with a negative decay with the legacy falloff, other lights are not affected
var attenuation = "float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {";
if (ShaderChunk.lights_pars_begin.indexOf(attenuation) !== -1 && ShaderChunk.lights_pars_begin.indexOf("nunuStudio legacy falloff") === -1)
{
	ShaderChunk.lights_pars_begin = ShaderChunk.lights_pars_begin.replace(attenuation, attenuation + `

	// nunuStudio legacy falloff, see LightConverter
	if ( decayExponent < 0.0 ) {

		return cutoffDistance > 0.0 ? pow( saturate( - lightDistance / cutoffDistance + 1.0 ), - decayExponent ) : 1.0;

	}
`);
}
else if (ShaderChunk.lights_pars_begin.indexOf("nunuStudio legacy falloff") === -1)
{
	console.warn("nunuStudio: LightConverter could not install the legacy light falloff, the three.js shader changed.");
}

// Materials with the legacy environment map define get reflections only from their environment map
var irradiance = "iblIrradiance += getIBLIrradiance( geometryNormal );";
if (ShaderChunk.lights_fragment_maps.indexOf(irradiance) !== -1 && ShaderChunk.lights_fragment_maps.indexOf(LightConverter.LEGACY_ENVMAP) === -1)
{
	ShaderChunk.lights_fragment_maps = ShaderChunk.lights_fragment_maps.replace(irradiance, "#ifndef " + LightConverter.LEGACY_ENVMAP + "\n\t\t\t" + irradiance + "\n\t\t\t#endif");
}
else if (ShaderChunk.lights_fragment_maps.indexOf(LightConverter.LEGACY_ENVMAP) === -1)
{
	console.warn("nunuStudio: LightConverter could not install the legacy environment map lighting, the three.js shader changed.");
}

export {LightConverter};
