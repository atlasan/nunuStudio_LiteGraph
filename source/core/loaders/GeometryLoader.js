import {BufferGeometry, DefaultLoadingManager, FileLoader, ObjectLoader} from "three";
import {TerrainBufferGeometry} from "../geometries/TerrainBufferGeometry.js";
import {RoundedBoxBufferGeometry} from "../geometries/RoundedBoxBufferGeometry.js";
import {CapsuleBufferGeometry} from "../geometries/CapsuleBufferGeometry.js";
import {ParametricBufferGeometry} from "../geometries/ParametricBufferGeometry.js";
import {LegacyGeometryLoader} from "./LegacyGeometryLoader.js";
import {Compatibility} from "../three/Compatibility.js";

/**
 * Geometry loader can be used to load geometry files.
 * 
 * @class GeometryLoader
 * @module Loaders
 * @param {Object} manager
 */
class GeometryLoader
{
	constructor(manager)
	{
		this.manager = manager !== undefined ? manager : DefaultLoadingManager;

		this.shapes = {};

		this.images = {};
	}

	/**
	 * Set list of images to be used by the loader.
	 *
	 * @method setImages
	 * @param {Array} images
	 */
	setImages(images)
	{
		this.images = images;
		return this;
	}

	/**
	 * Set list of shapes to be used by this loader.
	 *
	 * @method setShapes
	 * @param {Array} shapes
	 */
	setShapes(shapes)
	{
		this.shapes = shapes;
		return this;
	}

	/**
	 * Load geometry json file from URL.
	 *
	 * @method load
	 * @param {string} url
	 * @param {Function} onLoad
	 * @param {Function} onProgress
	 * @param {Function} onError
	 */
	load(url, onLoad, onProgress, onError)
	{
		var loader = new FileLoader(this.manager);
		loader.load(url, function(text)
		{
			onLoad(self.parse(JSON.parse(text)));
		}, onProgress, onError);
	}

	/**
	 * Parse geometry json.
	 *
	 * @method parse
	 * @param {Object} json
	 * @return {Geometry} Geometry loaded from json.
	 */
	parse(data)
	{
		var geometry = null;
	
		if (data.type === "CapsuleBufferGeometry")
		{
			geometry = new CapsuleBufferGeometry(data.radiusTop, data.radiusBottom, data.height, data.radialSegments, data.heightSegments, data.capsTopSegments, data.capsBottomSegments, data.thetaStart, data.thetaLength);
		}
		else if (data.type === "RoundedBoxBufferGeometry")
		{
			geometry = new RoundedBoxBufferGeometry(data.width, data.height, data.depth, data.radius, data.radiusSegments);
		}
		else if (data.type === "TerrainBufferGeometry")
		{
			geometry = new TerrainBufferGeometry(data.width, data.height, data.widthSegments, data.heightSegments, data.scale, this.images[data.image]);
		}
		else if (data.type === "ParametricBufferGeometry")
		{
			geometry = new ParametricBufferGeometry(data.code, data.slices, data.stacks);
		}
		else if (data.type === "Geometry")
		{
			var loader = new LegacyGeometryLoader();
			geometry = loader.parse(data.data).geometry;
		}

		else
		{
			try
			{
				// Geometry types renamed by three.js (e.g. SphereBufferGeometry is now SphereGeometry)
				var json = Object.assign({}, data, {type: Compatibility.getTypeName(data.type)});
				var geometries = ObjectLoader.prototype.parseGeometries([json], this.shapes);
				for (var i in geometries)
				{
					geometry = geometries[i];
					break;
				}

				if (geometry === null || geometry === undefined)
				{
					throw new Error("Unsupported geometry type " + data.type);
				}
			}
			catch (e)
			{
				console.warn("nunuStudio: Failed to parse geometry", data.type, data.uuid, e);

				geometry = new BufferGeometry();
			}
		}

		geometry.uuid = data.uuid;
		geometry.name = data.name !== undefined ? data.name : "geometry";

		return geometry;
	}
}


export {GeometryLoader};
