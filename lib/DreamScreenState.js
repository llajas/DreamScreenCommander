'use strict';

class DreamScreenState {
  constructor() {
    // Color state (HSV)
    this.hue = 0;
    this.saturation = 0;
    this.brightness = 100;

    // RGB cache (derived from HSV)
    this.red = 255;
    this.green = 255;
    this.blue = 255;

    // Device mode: 0=Sleep, 1=Video, 2=Music, 3=Ambient
    this.mode = 0;

    // Ambient scene: 0=Random, 1=Fireside, 2=Twinkle, 3=Ocean, 4=Rainbow, 5=July4th, 6=Holiday, 7=Pop, 8=Forest
    this.ambientScene = 0;

    // Ambient mode type: 0=Color, 1=Scene
    this.ambientModeType = 0;

    // HDMI input source: 0, 1, 2
    this.hdmiInput = 0;

    // Power state (derived from mode !== 0)
    this.isOn = false;

    // Device info (populated from state read)
    this.deviceName = '';
    this.groupName = '';
    this.groupNumber = 0;
    this.productId = 0; // 1=HD, 2=4K, 3=SideKick

    // Polling state
    this.lastUpdated = null;
    this.lastError = null;
  }

  /**
   * Update power state based on mode
   */
  updatePowerState() {
    this.isOn = this.mode !== 0;
  }

  /**
   * Update RGB values from current HSV
   * @param {Function} hsvToRgb - Color conversion function
   */
  updateRgbFromHsv(hsvToRgb) {
    const minSaturation = 60;
    const adjustedSaturation = this.saturation < minSaturation 
      ? minSaturation + (this.saturation * (100 - minSaturation) / 100)
      : this.saturation;
    
    const rgb = hsvToRgb({
      h: this.hue,
      s: adjustedSaturation,
      v: 100
    });

    let r = rgb.r;
    let g = rgb.g;
    let b = rgb.b;

    if (this.hue >= 220 && this.hue <= 300 && b > 100) {
      const reductionFactor = 0.15;
      r = Math.round(r * reductionFactor);
    }

    this.red = r;
    this.green = g;
    this.blue = b;
  }

  /**
   * Update HSV values from RGB
   * @param {Function} rgbToHsv - Color conversion function
   */
  updateHsvFromRgb(rgbToHsv) {
    const hsv = rgbToHsv({
      r: this.red,
      g: this.green,
      b: this.blue
    });
    this.hue = hsv.h || 0;
    this.saturation = hsv.s || 0;

  }

  /**
   * Set mode and update derived state
   * @param {number} mode - 0=Sleep, 1=Video, 2=Music, 3=Ambient
   */
  setMode(mode) {
    this.mode = mode;
    this.updatePowerState();
  }

  /**
   * Parse state from device response payload
   * @param {Buffer} payload - Response payload from device
   * @param {Function} rgbToHsv - Color conversion function
   * @returns {boolean} - True if parse successful
   */
  parseFromPayload(payload, rgbToHsv) {
    if (!payload || payload.length < 34) {
      return false;
    }

    try {
      // Product ID is always the last byte
      this.productId = payload[payload.length - 1];

      // Common fields for HD (0x01) and 4K (0x02)
      if (this.productId === 0x01 || this.productId === 0x02) {
        // Device name: bytes 0-15 (null-terminated string)
        this.deviceName = payload.slice(0, 16).toString('utf8').replace(/\0/g, '').trim();

        // Group name: bytes 16-31
        this.groupName = payload.slice(16, 32).toString('utf8').replace(/\0/g, '').trim();

        // Group number: byte 32
        this.groupNumber = payload[32];

        // Mode: byte 33
        if (payload.length > 33) {
          this.mode = payload[33];
          this.updatePowerState();
        }

        // Brightness: byte 34
        if (payload.length > 34) {
          this.brightness = payload[34];
        }

        // Ambient color RGB: bytes 40-42
        if (payload.length > 42) {
          this.red = payload[40];
          this.green = payload[41];
          this.blue = payload[42];
          this.updateHsvFromRgb(rgbToHsv);
        }

        // Ambient scene: byte 62
        if (payload.length > 62) {
          this.ambientScene = payload[62];
        }

        // HDMI input: byte 73
        if (payload.length > 73) {
          this.hdmiInput = payload[73];
        }
      }
      // SideKick (0x03) has different offsets
      else if (this.productId === 0x03) {
        this.deviceName = payload.slice(0, 16).toString('utf8').replace(/\0/g, '').trim();
        this.groupName = payload.slice(16, 32).toString('utf8').replace(/\0/g, '').trim();
        this.groupNumber = payload[32];

        if (payload.length > 33) {
          this.mode = payload[33];
          this.updatePowerState();
        }

        if (payload.length > 34) {
          this.brightness = payload[34];
        }

        // SideKick ambient color: bytes 35-37
        if (payload.length > 37) {
          this.red = payload[35];
          this.green = payload[36];
          this.blue = payload[37];
          this.updateHsvFromRgb(rgbToHsv);
        }

        // SideKick ambient scene: byte 60
        if (payload.length > 60) {
          this.ambientScene = payload[60];
        }
      }

      this.lastUpdated = new Date();
      this.lastError = null;
      return true;
    } catch (err) {
      this.lastError = err.message;
      return false;
    }
  }

  /**
   * Get a snapshot of current state for logging/debugging
   * @returns {Object}
   */
  toJSON() {
    return {
      hue: this.hue,
      saturation: this.saturation,
      brightness: this.brightness,
      rgb: { r: this.red, g: this.green, b: this.blue },
      mode: this.mode,
      isOn: this.isOn,
      ambientScene: this.ambientScene,
      ambientModeType: this.ambientModeType,
      hdmiInput: this.hdmiInput,
      deviceName: this.deviceName,
      productId: this.productId,
      lastUpdated: this.lastUpdated
    };
  }
}

// Mode constants
DreamScreenState.MODE_SLEEP = 0;
DreamScreenState.MODE_VIDEO = 1;
DreamScreenState.MODE_MUSIC = 2;
DreamScreenState.MODE_AMBIENT = 3;

// Product ID constants
DreamScreenState.PRODUCT_HD = 0x01;
DreamScreenState.PRODUCT_4K = 0x02;
DreamScreenState.PRODUCT_SIDEKICK = 0x03;

// Scene constants
DreamScreenState.SCENE_RANDOM = 0;
DreamScreenState.SCENE_FIRESIDE = 1;
DreamScreenState.SCENE_TWINKLE = 2;
DreamScreenState.SCENE_OCEAN = 3;
DreamScreenState.SCENE_RAINBOW = 4;
DreamScreenState.SCENE_JULY4TH = 5;
DreamScreenState.SCENE_HOLIDAY = 6;
DreamScreenState.SCENE_POP = 7;
DreamScreenState.SCENE_FOREST = 8;

module.exports = DreamScreenState;
