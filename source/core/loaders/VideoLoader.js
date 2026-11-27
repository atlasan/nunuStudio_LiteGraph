import {DefaultLoadingManager, FileLoader} from "three";

import {Video} from "../resources/Video.js";

/**
 * VideoLoader can be used to load external video resources.
 *
 * @class VideoLoader
 * @module Loaders
 * @param {Object} manager
 */
class VideoLoader
{
	constructor(manager)
	{
		this.manager = manager !== undefined ? manager : DefaultLoadingManager;
	}

	/**
	 * Load video resource from URL.
	 *
	 * @method load
	 * @param {string} url
	 * @param {Function} onLoad
	 * @param {Function} onProgress
	 * @param {Function} onError
	 */
	load(url, onLoad, onProgress, onError)
	{
		var self = this;
	
		var loader = new FileLoader(this.manager);
		loader.load(url, function(text)
		{
			onLoad(self.parse(JSON.parse(text)));
		}, onProgress, onError);
	}

	/**
	 * Parse material JSON.
	 *
	 * @method parse
	 * @param {Object} json
	 * @return {Material} material
	 */
	parse(json)
	{
		var video = new Video(json.data.toArrayBuffer !== undefined ? json.data.toArrayBuffer() : json.data, json.encoding);
	
		video.name = json.name;
		video.uuid = json.uuid;
	
		return video;
	}
}

export {VideoLoader};
