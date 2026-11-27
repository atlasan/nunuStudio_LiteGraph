import {BufferAttribute, DynamicDrawUsage, StaticDrawUsage} from "three";
import {TypedArrayHelper} from "./TypedArrayHelper.js";

/**
 * A helper to handle creating and updating a BufferAttribute instance.
 *
 * @constructor
 * @class ShaderAttribute
 * @param {string} type The buffer attribute type. See ShaderAttribute.typeSizeMap for valid values.
 * @param {boolean} dynamicBuffer Whether this buffer attribute should be marked as dynamic or not.
 * @param {Function} arrayType A reference to a TypedArray constructor. Defaults to Float32Array if none provided.
 */
class ShaderAttribute
{
	constructor(type, dynamicBuffer, arrayType)
	{
		this.type = typeof type === "string" && ShaderAttribute.typeSizeMap.hasOwnProperty(type) ? type : "f";
		this.componentSize = ShaderAttribute.typeSizeMap[this.type];
		this.arrayType = arrayType || Float32Array;
		this.typedArray = null;
		this.bufferAttribute = null;
		this.dynamicBuffer = Boolean(dynamicBuffer);

		this.updateMin = 0;
		this.updateMax = 0;
	}

	/**
	 * Calculate the minimum and maximum update range for this buffer attribute using component size independant min and max values.
	 *
	 * @method setUpdateRange
	 * @param {number} min The start of the range to mark as needing an update.
	 * @param {number} max The end of the range to mark as needing an update.
	 */
	setUpdateRange(min, max)
	{
		this.updateMin = Math.min(min * this.componentSize, this.updateMin * this.componentSize);
		this.updateMax = Math.max(max * this.componentSize, this.updateMax * this.componentSize);
	}

	/**
	 * Calculate the number of indices that this attribute should mark as needing updating. Also marks the attribute as needing an update.
	 *
	 * @method flagUpdate
	 */
	flagUpdate()
	{
		var range = this.bufferAttribute.updateRange;
		range.offset = this.updateMin;
		range.count = Math.min(this.updateMax - this.updateMin + this.componentSize, this.typedArray.array.length);

		this.bufferAttribute.needsUpdate = true;
	}

	/**
	 * Reset the index update counts for this attribute
	 *
	 * @method resetUpdateRange
	 */
	resetUpdateRange()
	{
		this.updateMin = 0;
		this.updateMax = 0;
	}

	resetDynamic()
	{
		this.bufferAttribute.usage = this.dynamicBuffer ? DynamicDrawUsage : StaticDrawUsage;
	}

	/**
	 * Perform a splice operation on this attribute"s buffer.
	 *
	 * @method splice
	 * @param {number} start The start index of the splice. Will be multiplied by the number of components for this attribute.
	 * @param {number} end The end index of the splice. Will be multiplied by the number of components for this attribute.
	 */
	splice(start, end)
	{
		this.typedArray.splice(start, end);

		// Reset the reference to the attribute"s typed array since it has probably changed.
		this.forceUpdateAll();
	}

	forceUpdateAll()
	{
		this.bufferAttribute.array = this.typedArray.array;
		this.bufferAttribute.updateRange.offset = 0;
		this.bufferAttribute.updateRange.count = -1;
		this.bufferAttribute.usage = StaticDrawUsage;
		this.bufferAttribute.needsUpdate = true;
	}

	/**
	 * Make sure this attribute has a typed array associated with it.
	 *
	 * If it does, then it will ensure the typed array is of the correct size.
	 *
	 * If not, a new TypedArrayHelper instance will be created.
	 *
	 * @method _ensureTypedArray
	 * @param {number} size The size of the typed array to create or update to.
	 */
	_ensureTypedArray(size)
	{
		// Condition that's most likely to be true at the top: no change.
		if (this.typedArray !== null && this.typedArray.size === size * this.componentSize)
		{
			return;
		}

		// Resize the array if we need to, telling the TypedArrayHelper to ignore it's component size when evaluating size.
		else if (this.typedArray !== null && this.typedArray.size !== size)
		{
			this.typedArray.setSize(size);
		}

		// This condition should only occur once in an attribute"s lifecycle.
		else if (this.typedArray === null)
		{
			this.typedArray = new TypedArrayHelper(this.arrayType, size, this.componentSize);
		}
	}

	/**
	 * Creates a BufferAttribute instance if one doesn't exist already.
	 *
	 * Ensures a typed array is present by calling _ensureTypedArray() first.
	 *
	 * If a buffer attribute exists already, then it will be marked as needing an update.
	 *
	 * @method _createBufferAttribute
	 * @param {number} size The size of the typed array to create if one doesn't exist, or resize existing array to.
	 */
	_createBufferAttribute(size)
	{
		// Make sure the typedArray is present and correct.
		this._ensureTypedArray(size);

		// Don't create it if it already exists, but do flag that it needs updating on the next render cycle.
		if (this.bufferAttribute !== null)
		{
			this.bufferAttribute.array = this.typedArray.array;
			this.bufferAttribute.count = this.bufferAttribute.array.length / this.bufferAttribute.itemSize;
			this.bufferAttribute.needsUpdate = true;
			return;
		}

		this.bufferAttribute = new BufferAttribute(this.typedArray.array, this.componentSize);
		this.bufferAttribute.usage = this.dynamicBuffer ? DynamicDrawUsage : StaticDrawUsage;
	}

	/**
	 * Returns the length of the typed array associated with this attribute.
	 *
	 * @method getLength
	 * @return {number} The length of the typed array. Will be 0 if no typed array has been created yet.
	 */
	getLength()
	{
		if (this.typedArray === null)
		{
			return 0;
		}

		return this.typedArray.array.length;
	}
}

ShaderAttribute.constructor = ShaderAttribute;

/**
 * A map of uniform types to their component size.
 *
 * @static
 * @attribute typeSizeMap
 */
ShaderAttribute.typeSizeMap =
{
	f: 1,
	v2: 2,
	v3: 3,
	v4: 4,
	c: 3,
	m3: 9,
	m4: 16
};


export {ShaderAttribute};
