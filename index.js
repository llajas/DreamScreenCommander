'use strict';

const colorsys = require('colorsys');
const DreamScreenUDP = require('./lib/DreamScreenUDP');
const DreamScreenState = require('./lib/DreamScreenState');

let Service, Characteristic, HapStatusError, HAPStatus;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  HapStatusError = homebridge.hap.HapStatusError;
  HAPStatus = homebridge.hap.HAPStatus;
  homebridge.registerAccessory('homebridge-dreamscreen-commander', 'DreamscreenRM', DreamscreenRMAccessory);
};

const DEBOUNCE_MS = 150;
const DEFAULT_POLL_INTERVAL_MS = 10000;

function DreamscreenRMAccessory(log, config) {
  this.log = log;
  this.name = config.name || 'DreamScreen';
  this.ip = config.ipadress;
  this.group = parseInt(config.group, 10) || 0;
  this.model = config.model || 'HD';
  this.pollIntervalMs = (config.pollInterval || 10) * 1000;

  this.state = new DreamScreenState();
  this.udp = new DreamScreenUDP({
    ip: this.ip,
    group: this.group,
    pollIntervalMs: this.pollIntervalMs
  });

  this.debounceTimer = null;
  this.pendingColorUpdate = false;

  this.setupUdpListeners();

  this.log.info(`Initialized '${this.name}' at ${this.ip} (group: ${this.group})`);
}

DreamscreenRMAccessory.prototype.setupUdpListeners = function() {
  this.udp.on('state-response', (data) => {
    if (data.ip === this.ip) {
      const oldMode = this.state.mode;
      const oldBrightness = this.state.brightness;

      if (this.state.parseFromPayload(data.payload, colorsys.rgb_to_hsv)) {
        this.log.debug('State updated from device:', this.state.toJSON());
        this.syncHomeKitState(oldMode, oldBrightness);
      }
    }
  });

  this.udp.on('error', (err) => {
    this.log.error('UDP error:', err.message);
  });

  this.udp.on('poll-error', (err) => {
    this.log.warn('Poll error:', err.message);
  });
};

DreamscreenRMAccessory.prototype.syncHomeKitState = function(oldMode, oldBrightness) {
  if (this.lightService) {
    if (oldBrightness !== this.state.brightness) {
      this.lightService.updateCharacteristic(Characteristic.Brightness, this.state.brightness);
    }
    this.lightService.updateCharacteristic(Characteristic.Hue, this.state.hue);
    this.lightService.updateCharacteristic(Characteristic.Saturation, this.state.saturation);
  }

  if (oldMode !== this.state.mode) {
    this.updateModeSwitch(this.ambilightService, this.state.mode === DreamScreenState.MODE_VIDEO);
    this.updateModeSwitch(this.ambientService, this.state.mode === DreamScreenState.MODE_AMBIENT);
    this.updateModeSwitch(this.musicService, this.state.mode === DreamScreenState.MODE_MUSIC);
  }
};

DreamscreenRMAccessory.prototype.updateModeSwitch = function(service, isOn) {
  if (service) {
    service.updateCharacteristic(Characteristic.On, isOn);
  }
};

DreamscreenRMAccessory.prototype.debounceColorUpdate = function() {
  this.pendingColorUpdate = true;

  if (this.debounceTimer) {
    clearTimeout(this.debounceTimer);
  }

  this.debounceTimer = setTimeout(async () => {
    this.debounceTimer = null;
    if (this.pendingColorUpdate) {
      this.pendingColorUpdate = false;
      await this.sendColor();
    }
  }, DEBOUNCE_MS);
};

DreamscreenRMAccessory.prototype.sendColor = async function() {
  this.log.info(`HSV before conversion: H=${this.state.hue}, S=${this.state.saturation}, V=100`);
  this.state.updateRgbFromHsv(colorsys.hsv_to_rgb);
  this.log.info(`Setting color to RGB(${this.state.red}, ${this.state.green}, ${this.state.blue})`);

  try {
    await this.udp.setAmbientColor(this.state.red, this.state.green, this.state.blue);
    this.state.setMode(DreamScreenState.MODE_AMBIENT);
    this.updateModeSwitch(this.ambilightService, false);
    this.updateModeSwitch(this.ambientService, true);
    this.updateModeSwitch(this.musicService, false);
  } catch (err) {
    this.log.error('Failed to set color:', err.message);
    throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  }
};

DreamscreenRMAccessory.prototype.setMode = async function(mode) {
  this.log.info(`Setting mode to ${mode}`);

  try {
    await this.udp.setMode(mode);
    this.state.setMode(mode);

    this.updateModeSwitch(this.ambilightService, mode === DreamScreenState.MODE_VIDEO);
    this.updateModeSwitch(this.ambientService, mode === DreamScreenState.MODE_AMBIENT);
    this.updateModeSwitch(this.musicService, mode === DreamScreenState.MODE_MUSIC);
  } catch (err) {
    this.log.error('Failed to set mode:', err.message);
    throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  }
};

DreamscreenRMAccessory.prototype.setScene = async function(scene) {
  this.log.info(`Setting scene to ${scene}`);

  try {
    await this.udp.setScene(scene);
    this.state.ambientScene = scene;
    this.state.setMode(DreamScreenState.MODE_AMBIENT);

    this.updateModeSwitch(this.ambilightService, false);
    this.updateModeSwitch(this.ambientService, true);
    this.updateModeSwitch(this.musicService, false);
  } catch (err) {
    this.log.error('Failed to set scene:', err.message);
    throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  }
};

DreamscreenRMAccessory.prototype.getServices = function() {
  const services = [];

  this.infoService = new Service.AccessoryInformation();
  this.infoService
    .setCharacteristic(Characteristic.Manufacturer, 'DreamScreen LLC')
    .setCharacteristic(Characteristic.Model, `DreamScreen ${this.model}`)
    .setCharacteristic(Characteristic.SerialNumber, this.ip)
    .setCharacteristic(Characteristic.FirmwareRevision, '2.0.0');
  services.push(this.infoService);

  this.lightService = new Service.Lightbulb('DS Brightness');
  this.lightService.subtype = this.name;

  this.lightService
    .addCharacteristic(Characteristic.Brightness)
    .onGet(() => this.state.brightness)
    .onSet(async (value) => {
      this.state.brightness = value;
      this.log.info(`Setting brightness to ${value}`);
      try {
        await this.udp.setBrightness(value);
      } catch (err) {
        this.log.error('Failed to set brightness:', err.message);
        throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      }
    });

  this.lightService
    .addCharacteristic(Characteristic.Hue)
    .onGet(() => this.state.hue)
    .onSet(async (value) => {
      if (value > 0) {
        this.state.hue = value;
        this.log.debug(`Hue set to ${value}`);
        this.debounceColorUpdate();
      }
    });

  this.lightService
    .addCharacteristic(Characteristic.Saturation)
    .onGet(() => this.state.saturation)
    .onSet(async (value) => {
      if (value > 0) {
        this.state.saturation = value;
        this.log.debug(`Saturation set to ${value}`);
        this.debounceColorUpdate();
      }
    });

  services.push(this.lightService);

  this.ambilightService = this.createModeSwitch('1. Ambilight', 'Ambilight',
    DreamScreenState.MODE_VIDEO, DreamScreenState.MODE_SLEEP);
  services.push(this.ambilightService);

  this.ambientService = this.createModeSwitch('2. Ambient', 'Ambient',
    DreamScreenState.MODE_AMBIENT, DreamScreenState.MODE_VIDEO);
  services.push(this.ambientService);

  this.musicService = this.createModeSwitch('3. Music', 'Music',
    DreamScreenState.MODE_MUSIC, DreamScreenState.MODE_VIDEO);
  services.push(this.musicService);

  this.scene1 = this.createSceneSwitch('Twinkle - Fireside', 'Fireside',
    DreamScreenState.SCENE_TWINKLE, DreamScreenState.SCENE_FIRESIDE);
  services.push(this.scene1);

  this.scene2 = this.createSceneSwitch('Rainbow - Ocean', 'Ocean',
    DreamScreenState.SCENE_RAINBOW, DreamScreenState.SCENE_OCEAN);
  services.push(this.scene2);

  this.scene3 = this.createSceneSwitch('Holiday - July 4th', 'July4th',
    DreamScreenState.SCENE_HOLIDAY, DreamScreenState.SCENE_JULY4TH);
  services.push(this.scene3);

  this.scene4 = this.createSceneSwitch('Forest - Pop', 'Pop',
    DreamScreenState.SCENE_FOREST, DreamScreenState.SCENE_POP);
  services.push(this.scene4);

  this.udp.init().then(() => {
    this.udp.startPolling();
    this.log.info('UDP client initialized, polling started');
  }).catch(err => {
    this.log.error('Failed to initialize UDP client:', err.message);
  });

  return services;
};

DreamscreenRMAccessory.prototype.createModeSwitch = function(name, subtype, onMode, offMode) {
  const service = new Service.Switch(name);
  service.subtype = subtype;

  service.getCharacteristic(Characteristic.On)
    .onGet(() => this.state.mode === onMode)
    .onSet(async (value) => {
      if (value) {
        await this.setMode(onMode);
      } else {
        await this.setMode(offMode);
      }
    });

  return service;
};

DreamscreenRMAccessory.prototype.createSceneSwitch = function(name, subtype, onScene, offScene) {
  const service = new Service.Switch(name);
  service.subtype = subtype;

  service.getCharacteristic(Characteristic.On)
    .onGet(() => this.state.ambientScene === onScene && this.state.mode === DreamScreenState.MODE_AMBIENT)
    .onSet(async (value) => {
      if (value) {
        await this.setScene(onScene);
      } else {
        await this.setScene(offScene);
      }
    });

  return service;
};
