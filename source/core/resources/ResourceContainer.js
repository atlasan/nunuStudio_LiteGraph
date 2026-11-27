/**
 * Resource container contains resource of multiple types.
 *
 * @method ResourceContainer
 */
class ResourceContainer
{
	constructor()
	{
		/**
		 * Image resources.
		 * 
		 * @property images
		 * @type {Array}
		 */
		this.images = [];

		/**
		 * Video resources.
		 * 
		 * @property videos
		 * @type {Array}
		 */
		this.videos = [];

		/**
		 * Audio resources.
		 * 
		 * @property audio
		 * @type {Array}
		 */
		this.audio = [];

		/**
		 * Fonts resources.
		 * 
		 * @property fonts
		 * @type {Array}
		 */
		this.fonts = [];

		/**
		 * Materials resources.
		 * 
		 * @property materials
		 * @type {Array}
		 */
		this.materials = [];

		/**
		 * Textures resources.
		 * 
		 * @property textures
		 * @type {Array}
		 */
		this.textures = [];

		/**
		 * Geometries resources.
		 * 
		 * @property geometries
		 * @type {Array}
		 */
		this.geometries = [];

		/**
		 * Generic resources, can be program data, code files etc.
		 * 
		 * @property resources
		 * @type {Array}
		 */
		this.resources = [];

		/**
		 * Shapes resources, may be used to generate geometry data.
		 * 
		 * @property shapes
		 * @type {Array}
		 */
		this.shapes = [];

		/**
		 * Skeletons resources, use for the meshes to store their skeleton data.
		 *
		 * Skeletons can be shared between meshes.
		 * 
		 * @property skeletons
		 * @type {Array}
		 */
		this.skeletons = [];
	}

	/**
	 * Copy resources from another resource container into this one.
	 *
	 * @method copyResources
	 */
	copyResources(container)
	{
		this.materials = container.materials;
		this.textures = container.textures;
		this.resources = container.resources;
		this.fonts = container.fonts;
		this.audio = container.audio;
		this.geometries = container.geometries;
		this.images = container.images;
		this.videos = container.videos;
		this.shapes = container.shapes;
		this.skeletons = container.skeletons;
	}

	getTexture(uuid)
	{
		if (this.textures[uuid] === undefined)
		{
			console.warn("nunuStudio: ResourceContainer, Undefined texture", uuid);
		}

		return this.textures[uuid];
	}

	getGeometry(uuid)
	{
		if (this.geometries[uuid] === undefined)
		{
			console.warn("nunuStudio: ResourceContainer, Undefined geometry", uuid);
		}
	
		return this.geometries[uuid];
	}

	getMaterial(uuid)
	{
		if (uuid instanceof Array)
		{
			var array = [];
			for (var i = 0; i < uuid.length; i++)
			{
				if (this.materials[uuid[i]] === undefined)
				{
					console.warn("nunuStudio: ResourceContainer, Undefined material", uuid);
				}

				array.push(this.materials[uuid[i]]);
			}
		
			return array;
		}

		if (this.materials[uuid] === undefined)
		{
			console.warn("nunuStudio: ResourceContainer, Undefined material", uuid);
		}

		return this.materials[uuid];
	}

	getFont(uuid)
	{
		if (this.fonts[uuid] === undefined)
		{
			console.warn("nunuStudio: ResourceContainer, Undefined font", uuid);
		}
		return this.fonts[uuid];
	}

	getAudio(uuid)
	{
		if (this.audio[uuid] === undefined)
		{
			console.warn("nunuStudio: ResourceContainer, Undefined audio", uuid);
		}
		return this.audio[uuid];
	}
};

ResourceContainer.libraries = ["images", "videos", "audio", "fonts", "materials", "textures", "geometries", "resources", "shapes", "skeletons"];

export {ResourceContainer};
