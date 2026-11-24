import {LiteGraph} from "../../../lib/litegraph.js";

const catalog = new Map();
const schemas = new Map();

/** One registration path for stable IDs, discovery metadata and executable nodes. */
function registerNunuNode(type, constructor, definition)
{
	if (catalog.has(type)) { throw new Error("Duplicate nunu node type: " + type); }
	if (!definition.category || !definition.accepts || !definition.effect) { throw new Error("Incomplete nunu node definition: " + type); }
	LiteGraph.registerNodeType(type, constructor);
	catalog.set(type, Object.freeze(Object.assign({
		type: type,
		title: constructor.title,
		description: constructor.desc,
		since: 1
	}, definition)));
}

/** Portable, detached copies: safe for UI, docs and exported catalog JSON. */
function getNunuNodeCatalog()
{
	return Array.from(catalog.values(), function(definition)
	{
		if (!schemas.has(definition.type))
		{
			var node = LiteGraph.createNode(definition.type);
			function ports(list)
			{
				return (list || []).map(function(port) { return {name: port.name, type: port.type}; });
			}
			schemas.set(definition.type, {inputs: ports(node.inputs), outputs: ports(node.outputs), properties: node.properties || {}});
		}
		return JSON.parse(JSON.stringify(Object.assign({}, definition, schemas.get(definition.type))));
	}).sort(function(a, b) { return a.category.localeCompare(b.category) || a.title.localeCompare(b.title); });
}

export {registerNunuNode, getNunuNodeCatalog};
