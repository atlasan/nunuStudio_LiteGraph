THREE.KeyframeTrack.prototype.color = "#FF0000";

THREE.KeyframeTrack.prototype.setColor = function(color)
{
	this.color = color;
};

THREE.KeyframeTrack.prototype.sort = function()
{
	for (var i = 0; i < this.times.length; i++)
	{
		for (var j = i + 1; j < this.times.length; j++)
		{
			if (this.times[i] > this.times[j])
			{
				var temp = this.times[j];
				this.times[j] = this.times[i];
				this.times[i] = temp;

				var valueSize = this.getValueSize();
				var k = j * valueSize;
				var l = i * valueSize;

				for (var m = 0; m < valueSize; m++)
				{
					var temp = this.values[k + m];
					this.values[k + m] = this.values[l + m];
					this.values[l + m] = temp;
				}
			}
		}
	}
};

THREE.KeyframeTrack._toJSON = THREE.KeyframeTrack.toJSON;
THREE.KeyframeTrack.toJSON = function(track)
{
	var data = THREE.KeyframeTrack._toJSON.call(this, track);

	data.color = track.color;

	return data;
};

// three.js has no KeyframeTrack.parse anymore, AnimationClip.parse calls the parse method of the track subclass when there is one.
// This method is inherited by every track type, so build the track like three.js does by default (this is the track class).
THREE.KeyframeTrack.parse = function(json)
{
	var track = new this(json.name, json.times, json.values, json.interpolation);

	if (json.color !== undefined)
	{
		track.color = json.color;
	}

	return track;
};
