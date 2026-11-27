import {BufferGeometry, DefaultLoadingManager, FileLoader, Float32BufferAttribute, Uint16BufferAttribute, AnimationClip} from "three";

/**
 * Legacy geometry loader is used to load the old three.js geometry file format (v3/v4).
 *
 * The Geometry/Face3 classes this format was loaded into were removed from three.js, the data is converted directly into a
 * non indexed BufferGeometry: positions, normals, uv layers, colors, material groups, skinning, morph targets and animations.
 *
 * @class LegacyGeometryLoader
 * @module Loaders
 */
class LegacyGeometryLoader
{
	constructor(manager)
	{
		this.manager = manager !== undefined ? manager : DefaultLoadingManager;
		this.withCredentials = false;
	}

	load(url, onLoad, onProgress, onError)
	{
		var self = this;

		var loader = new FileLoader(this.manager);
		loader.setWithCredentials(this.withCredentials);
		loader.load(url, function(text)
		{
			var json = JSON.parse(text);
			var object = self.parse(json);
			onLoad(object.geometry, object.materials);
		}, onProgress, onError);
	}

	setPath(value)
	{
		this.path = value;
		return this;
	}

	setResourcePath(value)
	{
		this.resourcePath = value;
		return this;
	}

	setCrossOrigin(value)
	{
		this.crossOrigin = value;
		return this;
	}

	parse(json)
	{
		if (json.data !== undefined)
		{
			json = json.data;
		}

		var scale = json.scale !== undefined ? 1.0 / json.scale : 1.0;
		var vertices = json.vertices || [];
		var normals = json.normals || [];
		var colors = json.colors || [];
		var faces = json.faces || [];
		var uvLayers = (json.uvs || []).filter(function(layer) { return layer.length > 0; });
		var influences = json.influencesPerVertex !== undefined ? json.influencesPerVertex : 2;
		var skinned = json.skinIndices !== undefined && json.skinWeights !== undefined && json.skinIndices.length > 0;

		// Output per triangle corner
		var position = [], normal = [], color = [], skinIndex = [], skinWeight = [];
		var uv = uvLayers.map(function() { return []; });
		var vertexIndex = [];
		var groups = [];
		var hasNormals = true, hasColors = false;

		function isBitSet(value, bit)
		{
			return (value & 1 << bit) !== 0;
		}

		function addGroup(materialIndex)
		{
			var last = groups[groups.length - 1];
			var start = position.length / 3;
			if (last !== undefined && last.materialIndex === materialIndex)
			{
				last.count += 3;
			}
			else
			{
				groups.push({start: start, count: 3, materialIndex: materialIndex});
			}
		}

		var offset = 0;
		while (offset < faces.length)
		{
			var type = faces[offset++];
			var isQuad = isBitSet(type, 0);
			var corners = isQuad ? 4 : 3;

			var face = faces.slice(offset, offset + corners);
			offset += corners;

			var materialIndex = isBitSet(type, 1) ? faces[offset++] : 0;

			var faceUvs = [];
			if (isBitSet(type, 3))
			{
				for (var l = 0; l < uvLayers.length; l++)
				{
					faceUvs.push(faces.slice(offset, offset + corners));
					offset += corners;
				}
			}

			var faceNormal = isBitSet(type, 4) ? faces[offset++] : -1;
			var vertexNormals = null;
			if (isBitSet(type, 5))
			{
				vertexNormals = faces.slice(offset, offset + corners);
				offset += corners;
			}

			var faceColor = isBitSet(type, 6) ? faces[offset++] : -1;
			var vertexColors = null;
			if (isBitSet(type, 7))
			{
				vertexColors = faces.slice(offset, offset + corners);
				offset += corners;
			}

			if (faceNormal === -1 && vertexNormals === null)
			{
				hasNormals = false;
			}
			if (faceColor !== -1 || vertexColors !== null)
			{
				hasColors = true;
			}

			// Quads are split into (0, 1, 3) and (1, 2, 3)
			var triangles = isQuad ? [[0, 1, 3], [1, 2, 3]] : [[0, 1, 2]];
			for (var t = 0; t < triangles.length; t++)
			{
				addGroup(materialIndex);

				for (var c = 0; c < 3; c++)
				{
					var corner = triangles[t][c];
					var v = face[corner];

					vertexIndex.push(v);
					position.push(vertices[v * 3] * scale, vertices[v * 3 + 1] * scale, vertices[v * 3 + 2] * scale);

					var n = vertexNormals !== null ? vertexNormals[corner] : faceNormal;
					normal.push(n >= 0 ? normals[n * 3] : 0, n >= 0 ? normals[n * 3 + 1] : 0, n >= 0 ? normals[n * 3 + 2] : 0);

					var hex = vertexColors !== null ? colors[vertexColors[corner]] : faceColor !== -1 ? colors[faceColor] : 0xFFFFFF;
					color.push((hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255);

					for (var l = 0; l < uvLayers.length; l++)
					{
						var u = faceUvs.length > l ? faceUvs[l][corner] : -1;
						uv[l].push(u >= 0 ? uvLayers[l][u * 2] : 0, u >= 0 ? uvLayers[l][u * 2 + 1] : 0);
					}

					if (skinned)
					{
						for (var k = 0; k < 4; k++)
						{
							skinIndex.push(k < influences ? json.skinIndices[v * influences + k] : 0);
							skinWeight.push(k < influences ? json.skinWeights[v * influences + k] : 0);
						}
					}
				}
			}
		}

		var geometry = new BufferGeometry();
		geometry.setAttribute("position", new Float32BufferAttribute(position, 3));

		if (hasNormals && position.length > 0)
		{
			geometry.setAttribute("normal", new Float32BufferAttribute(normal, 3));
		}
		else
		{
			geometry.computeVertexNormals();
		}

		if (hasColors)
		{
			geometry.setAttribute("color", new Float32BufferAttribute(color, 3));
		}

		for (var l = 0; l < uv.length && l < 2; l++)
		{
			geometry.setAttribute(l === 0 ? "uv" : "uv1", new Float32BufferAttribute(uv[l], 2));
		}

		if (skinned)
		{
			geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndex, 4));
			geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeight, 4));
		}

		if (groups.length > 1 || groups.length === 1 && groups[0].materialIndex !== 0)
		{
			groups.forEach(function(group) { geometry.addGroup(group.start, group.count, group.materialIndex); });
		}

		// Morph targets, expanded to triangle corners like the positions
		if (json.morphTargets !== undefined && json.morphTargets.length > 0)
		{
			geometry.morphAttributes.position = json.morphTargets.map(function(target)
			{
				var array = [];
				for (var i = 0; i < vertexIndex.length; i++)
				{
					var v = vertexIndex[i];
					array.push(target.vertices[v * 3] * scale, target.vertices[v * 3 + 1] * scale, target.vertices[v * 3 + 2] * scale);
				}
				var attribute = new Float32BufferAttribute(array, 3);
				attribute.name = target.name;
				return attribute;
			});
		}

		// Bones and animations were stored with the geometry
		if (json.bones !== undefined)
		{
			geometry.bones = json.bones;
		}

		var animations = [];
		if (json.animation !== undefined) {animations.push(json.animation);}
		if (json.animations !== undefined) {animations = animations.concat(json.animations.length !== undefined ? json.animations : [json.animations]);}
		var clips = animations.map(function(animation) { return AnimationClip.parseAnimation(animation, json.bones); }).filter(function(clip) { return clip; });
		if (clips.length > 0)
		{
			geometry.animations = clips;
		}

		return {geometry: geometry, materials: []};
	}
}

export {LegacyGeometryLoader};
