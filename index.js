const colorsys = require('colorsys');
let Service, Characteristic, UUIDGen;
const { exec } = require('child_process');

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	UUIDGen = homebridge.hap.uuid;
	homebridge.registerAccessory("homebridge-dreamscreen-rm", "DreamscreenRM", DreamscreenRMAccessory);
};

function DreamscreenRMAccessory(log, config) {
	this.name = config["name"];
	this.ipadress = config["ipadress"];
	this.group = config["group"];
	this.model = config["model"];
	this.AmbilightName = "DS video mode";
	this.AmbientName = "DS ambient mode";
	this.MusicName = "DS music mode";
	this.lightService = new Service.Lightbulb("DS Brightness");
	this.lightService.subtype = this.name;
	this.infoService = new Service.AccessoryInformation();
    	this.log = log;
	this.log("Initialized '" + this.name + "'");
}

DreamscreenRMAccessory.prototype.setcolor = function(ipadress) {
  	const color = colorsys.hsv_to_rgb({
    		h: global.hue,
    		s: global.saturation,
    		v: global.brightness
  	});
  	this.log('set dreamscreen color to', color.r, color.g, color.b);
	command = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -c " + '"' + color.r + " " + color.g + " " + color.b + '"'
 	exec(command)
}

DreamscreenRMAccessory.prototype.getServices = function() {
	let services = [];

	this.lightService
	.addCharacteristic(Characteristic.Brightness)
	.on('set', (value, callback) => {
		global.brightness = value
		this.log("Set DreamScreen brightness to:", value)
  		command = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -b"  + value
		exec(command)
		callback();
	})

	this.lightService
	.addCharacteristic(Characteristic.Hue)
	.on('set', (value, callback) => {
		if (value > 0) {
			global.hue = value
			this.log("Set DreamScreen hue to:", value)
			this.setcolor(this.ipadress);
			callback();
		}
		else {
			callback();
		}
	})

	this.lightService
	.addCharacteristic(Characteristic.Saturation)
	.on('set', (value, callback) => {
		if (value > 0) {
			global.saturation = value
			this.log("Set DreamScreen saturation to:", value)
			this.setcolor(this.ipadress);
			callback();
		}
		else {
			callback();
		}
	})

	this.AmbilightService = new Service.Switch("1. Ambilight");
  	this.AmbilightService.subtype = this.AmbilightName;

	this.AmbilightService
	.getCharacteristic(Characteristic.On)
	.on('set', (value, callback) => {
	if (value) {
			this.log("Set mode to ambilight")
			this.lightService.setCharacteristic(Characteristic.Saturation, 0);
			this.lightService.setCharacteristic(Characteristic.Hue, 0);
			commandon = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -m 1"
			exec(commandon)
			callback();
	} else {
			this.log("Set DreamScreen to standby")
			commandoff = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -m 0"
			exec(commandoff)
			callback();
		}
	})

	this.AmbientService = new Service.Switch("2. Ambient");
  	this.AmbientService.subtype = this.AmbientName;

	this.AmbientService
	.getCharacteristic(Characteristic.On)
	.on('set', (value, callback) => {
	if (value) {
			this.log("Set mode to ambient")
			this.lightService.setCharacteristic(Characteristic.Saturation, 0);
			this.lightService.setCharacteristic(Characteristic.Hue, 0);
			commandon = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -m 3"
			exec(commandon)
			callback();
	} else {
			this.log("Set mode to ambilight")
			this.lightService.setCharacteristic(Characteristic.Saturation, 0);
			this.lightService.setCharacteristic(Characteristic.Hue, 0);
			commandoff = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -m 1"
			exec(commandoff)
			callback();
		}
	})

	this.MusicService = new Service.Switch("3. Musik");
  	this.MusicService.subtype = this.MusicName;

	this.MusicService
	.getCharacteristic(Characteristic.On)
	.on('set', (value, callback) => {
	if (value) {
			this.log("Set mode to music")
			this.lightService.setCharacteristic(Characteristic.Saturation, 0);
			this.lightService.setCharacteristic(Characteristic.Hue, 0);
			commandon = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -m 2"
			exec(commandon)
			callback();
	} else {
			this.log("Set mode to ambilight")
			this.lightService.setCharacteristic(Characteristic.Saturation, 0);
			this.lightService.setCharacteristic(Characteristic.Hue, 0);
			commandoff = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -m 1"
			exec(commandoff)
			callback();
		}
	})

	this.Scene1 = new Service.Switch("Twinkle - Fireside");
  	this.Scene1.subtype = "Fireside";

	this.Scene1
	.getCharacteristic(Characteristic.On)
	.on('set', (value, callback) => {
	if (value) {
			this.log("Set scene to Twinkle")
			this.lightService.setCharacteristic(Characteristic.Saturation, 0);
			this.lightService.setCharacteristic(Characteristic.Hue, 0);
			commandon = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -a 2"
			exec(commandon)
			callback();
	} else {
			this.log("Set scene to Fireside")
			this.lightService.setCharacteristic(Characteristic.Saturation, 0);
			this.lightService.setCharacteristic(Characteristic.Hue, 0);
			commandoff = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -a 1"
			exec(commandoff)
			callback();
		}
	})

	this.Scene2 = new Service.Switch("Rainbow - Ocean");
  	this.Scene2.subtype = "Ocean";

	this.Scene2
	.getCharacteristic(Characteristic.On)
	.on('set', (value, callback) => {
	if (value) {
			this.log("Set scene to Rainbow")
			this.lightService.setCharacteristic(Characteristic.Saturation, 0);
			this.lightService.setCharacteristic(Characteristic.Hue, 0);
			commandon = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -a 4"
			exec(commandon)
			callback();
	} else {
			this.log("Set scene to Ocean")
			this.lightService.setCharacteristic(Characteristic.Saturation, 0);
			this.lightService.setCharacteristic(Characteristic.Hue, 0);
			commandoff = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -a 3"
			exec(commandoff)
			callback();
		}
	})

	this.Scene3 = new Service.Switch("Holiday - July 4th");
  	this.Scene3.subtype = "July 4th";

	this.Scene3
	.getCharacteristic(Characteristic.On)
	.on('set', (value, callback) => {
	if (value) {
			this.log("Set scene to Holiday")
			this.lightService.setCharacteristic(Characteristic.Saturation, 0);
			this.lightService.setCharacteristic(Characteristic.Hue, 0);
			commandon = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -a 6"
			exec(commandon)
			callback();
	} else {
			this.log("Set scene to July 4th")
			this.lightService.setCharacteristic(Characteristic.Saturation, 0);
			this.lightService.setCharacteristic(Characteristic.Hue, 0);
			commandoff = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -a 5"
			exec(commandoff)
			callback();
		}
	})

	this.Scene4 = new Service.Switch("Forest - Pop");
  	this.Scene4.subtype = "Pop";

	this.Scene4
	.getCharacteristic(Characteristic.On)
	.on('set', (value, callback) => {
	if (value) {
			this.log("Set scene to Forest")
			this.lightService.setCharacteristic(Characteristic.Saturation, 0);
			this.lightService.setCharacteristic(Characteristic.Hue, 0);
			commandon = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -a 8"
			exec(commandon)
			callback();
	} else {
			this.log("Set scene to Pop")
			this.lightService.setCharacteristic(Characteristic.Saturation, 0);
			this.lightService.setCharacteristic(Characteristic.Hue, 0);
			commandoff = "python3 " + __dirname + "/engine/DreamScreenCommander.py -i " + this.ipadress + " -g " + this.group + " -a 7"
			exec(commandoff)
			callback();
		}
	})

		services.push(this.lightService);
		services.push(this.AmbilightService);
		services.push(this.AmbientService);
		services.push(this.MusicService);
		services.push(this.Scene1);
		services.push(this.Scene2);
		services.push(this.Scene3);
		services.push(this.Scene4);
		services.push(this.infoService);

	this.infoService
	.setCharacteristic(Characteristic.Manufacturer, "DreamScreen LCC")
	.setCharacteristic(Characteristic.Model, "DreamScreen " + this.model)
	.setCharacteristic(Characteristic.SerialNumber, this.ipadress)
	.setCharacteristic(Characteristic.FirmwareRevision, "1.6.17");

	return services;
};
