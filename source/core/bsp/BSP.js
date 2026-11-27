import {BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, Vector2, Vector3} from "three";
import {BSPNode} from "./BSPNode.js";
import {BSPPolygon} from "./BSPPolygon.js";
import {BSPVertex} from "./BSPVertex.js";

class BSP
{
	constructor(geometry)
	{
		// Convert BufferGeometry to BSP
		var polygons = [];

		if (geometry instanceof Mesh)
		{
			// #todo: add hierarchy support
			geometry.updateMatrix();
			this.matrix = geometry.matrix.clone();
			geometry = geometry.geometry;
		}
		else if (geometry instanceof BSPNode)
		{
			this.tree = geometry;
			this.matrix = new Matrix4();
			return this;
		}
		else if (geometry !== null && geometry !== undefined && geometry.isBufferGeometry === true)
		{
			this.matrix = new Matrix4();
		}
		else
		{
			throw new Error("nunuStudio: Given geometry is unsupported");
		}

		if (geometry.index !== null)
		{
			geometry = geometry.toNonIndexed();
		}
		if (geometry.getAttribute("normal") === undefined)
		{
			geometry = geometry.clone();
			geometry.computeVertexNormals();
		}

		var positions = geometry.getAttribute("position");
		var normals = geometry.getAttribute("normal");
		var uvs = geometry.getAttribute("uv");

		for (var i = 0; i + 2 < positions.count; i += 3)
		{
			var polygon = new BSPPolygon();

			for (var j = i; j < i + 3; j++)
			{
				var normal = new Vector3(normals.getX(j), normals.getY(j), normals.getZ(j));
				var uv = uvs !== undefined ? new Vector2(uvs.getX(j), uvs.getY(j)) : null;
				var vertex = new BSPVertex(positions.getX(j), positions.getY(j), positions.getZ(j), normal, uv);
				vertex.applyMatrix4(this.matrix);
				polygon.vertices.push(vertex);
			}

			polygon.calculateProperties();
			polygons.push(polygon);
		}

		this.tree = new BSPNode(polygons);
	}

	subtract(otherTree)
	{
		var a = this.tree.clone();
		var b = otherTree.tree.clone();

		a.invert();
		a.clipTo(b);
		b.clipTo(a);
		b.invert();
		b.clipTo(a);
		b.invert();
		a.build(b.allPolygons());
		a.invert();
		a = new BSP(a);
		a.matrix = this.matrix;
		return a;
	}

	union(otherTree)
	{
		var a = this.tree.clone();
		var b = otherTree.tree.clone();

		a.clipTo(b);
		b.clipTo(a);
		b.invert();
		b.clipTo(a);
		b.invert();
		a.build(b.allPolygons());
		a = new BSP(a);
		a.matrix = this.matrix;
		return a;
	}

	intersect(otherTree)
	{
		var a = this.tree.clone();
		var b = otherTree.tree.clone();

		a.invert();
		b.clipTo(a);
		b.invert();
		a.clipTo(b);
		b.clipTo(a);
		a.build(b.allPolygons());
		a.invert();
		a = new BSP(a);
		a.matrix = this.matrix;
		return a;
	}

	toGeometry()
	{
		var matrix = this.matrix.clone().invert();
		var polygons = this.tree.allPolygons();
		var positions = [];
		var normals = [];
		var uvs = [];
		var vertex = new Vector3();

		function push(v, normal)
		{
			vertex.set(v.x, v.y, v.z).applyMatrix4(matrix);
			positions.push(vertex.x, vertex.y, vertex.z);
			normals.push(normal.x, normal.y, normal.z);
			uvs.push(v.uv.x, v.uv.y);
		}

		for (var i = 0; i < polygons.length; i++)
		{
			var polygon = polygons[i];

			// Triangle fan for each convex polygon
			for (var j = 2; j < polygon.vertices.length; j++)
			{
				push(polygon.vertices[0], polygon.normal);
				push(polygon.vertices[j - 1], polygon.normal);
				push(polygon.vertices[j], polygon.normal);
			}
		}

		var geometry = new BufferGeometry();
		geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
		geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
		geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
		return geometry;
	}

	toMesh(material)
	{
		var geometry = this.toGeometry();
		var mesh = new Mesh(geometry, material);

		mesh.position.setFromMatrixPosition(this.matrix);
		mesh.rotation.setFromRotationMatrix(this.matrix);

		return mesh;
	}
};

export {BSP};
