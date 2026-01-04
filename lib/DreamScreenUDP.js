'use strict';

const dgram = require('dgram');
const EventEmitter = require('events');

const PORT = 8888;
const BROADCAST_GROUP = 0xFF;
const READ_STATE_FLAG = 0x30;
const WRITE_FLAG = 0x11;

// CRC8 lookup table (same as Python implementation)
const CRC_TABLE = [
  0, 7, 4, 9, 28, 27, 18, 21, 56, 63, 54, 49, 36, 35, 42, 45,
  112, 119, 126, 121, 108, 107, 98, 101, 72, 79, 70, 65, 84, 83, 90, 93,
  224, 231, 238, 233, 252, 251, 242, 245, 216, 223, 214, 209, 196, 195, 202, 205,
  144, 151, 158, 153, 140, 139, 130, 133, 168, 175, 166, 161, 180, 179, 186, 189,
  199, 192, 201, 206, 219, 220, 213, 210, 255, 248, 241, 246, 227, 228, 237, 234,
  183, 176, 185, 190, 171, 172, 165, 162, 143, 136, 129, 134, 147, 148, 157, 154,
  39, 32, 41, 46, 59, 60, 53, 50, 31, 24, 17, 22, 3, 4, 13, 10,
  87, 80, 89, 94, 75, 76, 69, 66, 111, 104, 97, 102, 115, 116, 125, 122,
  137, 142, 135, 0, 149, 146, 155, 156, 177, 182, 191, 184, 173, 170, 163, 164,
  249, 254, 247, 240, 229, 226, 235, 236, 193, 198, 207, 200, 221, 218, 211, 212,
  105, 110, 103, 96, 117, 114, 123, 124, 81, 86, 95, 88, 77, 74, 67, 68,
  25, 30, 23, 16, 5, 2, 11, 12, 33, 38, 47, 40, 61, 58, 51, 52,
  78, 73, 64, 71, 82, 85, 92, 91, 118, 113, 120, 255, 106, 109, 100, 99,
  62, 57, 48, 55, 34, 37, 44, 43, 6, 1, 8, 15, 26, 29, 20, 19,
  174, 169, 160, 167, 178, 181, 188, 187, 150, 145, 152, 159, 138, 141, 132, 131,
  222, 217, 208, 215, 194, 197, 204, 203, 230, 225, 232, 239, 250, 253, 244, 243
];

const CMD = {
  MODE: { upper: 0x03, lower: 0x01 },
  BRIGHTNESS: { upper: 0x03, lower: 0x02 },
  COLOR: { upper: 0x03, lower: 0x05 },
  AMBIENCE_TYPE: { upper: 0x03, lower: 0x08 },
  SCENE: { upper: 0x03, lower: 0x0D },
  SOURCE: { upper: 0x03, lower: 0x20 },
  READ_STATE: { upper: 0x01, lower: 0x0A }
};

class DreamScreenUDP extends EventEmitter {
  constructor(options = {}) {
    super();
    this.ip = options.ip;
    this.group = options.group || 0;
    this.socket = null;
    this.isListening = false;
    this.pollInterval = null;
    this.pollIntervalMs = options.pollIntervalMs || 5000;
    this.commandTimeout = options.commandTimeout || 1000;
  }

  calcCRC8(data) {
    let crc = 0;
    const size = data[1] + 1;
    for (let i = 0; i < size && i < data.length; i++) {
      crc = CRC_TABLE[(data[i] ^ crc) & 0xFF];
    }
    return crc;
  }

  buildPacket(group, flags, cmdUpper, cmdLower, payload = []) {
    const packet = [
      0xFC,
      payload.length + 5,
      group,
      flags,
      cmdUpper,
      cmdLower,
      ...payload
    ];
    const crc = this.calcCRC8(packet);
    packet.push(crc);
    return Buffer.from(packet);
  }

  init() {
    return new Promise((resolve, reject) => {
      if (this.socket) {
        resolve();
        return;
      }

      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.socket.on('error', (err) => {
        this.emit('error', err);
        if (!this.isListening) {
          reject(err);
        }
      });

      this.socket.on('message', (msg, rinfo) => {
        this.handleMessage(msg, rinfo);
      });

      this.socket.on('listening', () => {
        this.isListening = true;
        this.socket.setBroadcast(true);
        resolve();
      });

      this.socket.bind(PORT, () => {});
    });
  }

  handleMessage(msg, rinfo) {
    if (msg.length < 6) return;

    const startByte = msg[0];
    if (startByte !== 0xFC) return;

    const length = msg[1];
    const expectedLength = length + 2;

    if (msg.length < expectedLength) return;

    const crcReceived = msg[expectedLength - 1];
    const crcCalculated = this.calcCRC8(msg);

    if (crcReceived !== crcCalculated) {
      this.emit('crc-error', { received: crcReceived, calculated: crcCalculated, from: rinfo.address });
      return;
    }

    const group = msg[2];
    const flags = msg[3];
    const cmdUpper = msg[4];
    const cmdLower = msg[5];
    const payload = msg.slice(6, expectedLength - 1);

    this.emit('message', {
      ip: rinfo.address,
      port: rinfo.port,
      group,
      flags,
      cmdUpper,
      cmdLower,
      payload,
      raw: msg
    });

    if (cmdUpper === CMD.READ_STATE.upper && cmdLower === CMD.READ_STATE.lower) {
      this.emit('state-response', {
        ip: rinfo.address,
        payload
      });
    }
  }

  async send(packet, targetIp = null) {
    if (!this.socket) {
      await this.init();
    }

    const ip = targetIp || this.ip;
    if (!ip) {
      throw new Error('No target IP specified');
    }

    return new Promise((resolve, reject) => {
      this.socket.send(packet, 0, packet.length, PORT, ip, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async sendCommand(cmdUpper, cmdLower, payload = []) {
    const packet = this.buildPacket(this.group, WRITE_FLAG, cmdUpper, cmdLower, payload);
    return this.send(packet);
  }

  async setMode(mode) {
    return this.sendCommand(CMD.MODE.upper, CMD.MODE.lower, [mode]);
  }

  async setBrightness(brightness) {
    const value = Math.max(0, Math.min(100, brightness));
    return this.sendCommand(CMD.BRIGHTNESS.upper, CMD.BRIGHTNESS.lower, [value]);
  }

  async setColor(r, g, b) {
    const red = Math.max(0, Math.min(255, r));
    const green = Math.max(0, Math.min(255, g));
    const blue = Math.max(0, Math.min(255, b));
    return this.sendCommand(CMD.COLOR.upper, CMD.COLOR.lower, [red, green, blue]);
  }

  async setAmbienceType(type) {
    return this.sendCommand(CMD.AMBIENCE_TYPE.upper, CMD.AMBIENCE_TYPE.lower, [type]);
  }

  async setScene(scene) {
    await this.setAmbienceType(1);
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.sendCommand(CMD.SCENE.upper, CMD.SCENE.lower, [scene]);
  }

  async setSource(source) {
    const value = Math.max(0, Math.min(2, source));
    return this.sendCommand(CMD.SOURCE.upper, CMD.SOURCE.lower, [value]);
  }

  async setAmbientColor(r, g, b) {
    await this.setAmbienceType(0);
    await this.setMode(3);
    return this.setColor(r, g, b);
  }

  async readState(targetIp = null) {
    const packet = this.buildPacket(BROADCAST_GROUP, READ_STATE_FLAG, CMD.READ_STATE.upper, CMD.READ_STATE.lower, []);
    return this.send(packet, targetIp || this.ip);
  }

  startPolling(intervalMs = null) {
    if (this.pollInterval) {
      this.stopPolling();
    }

    const interval = intervalMs || this.pollIntervalMs;

    this.pollInterval = setInterval(async () => {
      try {
        await this.readState();
      } catch (err) {
        this.emit('poll-error', err);
      }
    }, interval);

    this.readState().catch(err => this.emit('poll-error', err));
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  close() {
    this.stopPolling();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isListening = false;
    }
  }
}

DreamScreenUDP.CMD = CMD;
DreamScreenUDP.PORT = PORT;
DreamScreenUDP.MODE = {
  SLEEP: 0,
  VIDEO: 1,
  MUSIC: 2,
  AMBIENT: 3
};
DreamScreenUDP.AMBIENCE_TYPE = {
  COLOR: 0,
  SCENE: 1
};
DreamScreenUDP.SCENE = {
  RANDOM: 0,
  FIRESIDE: 1,
  TWINKLE: 2,
  OCEAN: 3,
  RAINBOW: 4,
  JULY4TH: 5,
  HOLIDAY: 6,
  POP: 7,
  FOREST: 8
};

module.exports = DreamScreenUDP;
