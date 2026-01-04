#!/usr/bin/env node
'use strict';

/**
 * Standalone test script for DreamScreen UDP communication
 * Usage: node test-udp.js <IP_ADDRESS> [command]
 * 
 * Commands:
 *   read     - Read current device state (default)
 *   mode N   - Set mode (0=sleep, 1=video, 2=music, 3=ambient)
 *   bright N - Set brightness (0-100)
 *   scene N  - Set scene (0-8)
 */

const dgram = require('dgram');

const PORT = 8888;
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

function calcCRC8(data) {
  let crc = 0;
  const size = data[1] + 1;
  for (let i = 0; i < size && i < data.length; i++) {
    crc = CRC_TABLE[(data[i] ^ crc) & 0xFF];
  }
  return crc;
}

function buildPacket(group, flags, cmdUpper, cmdLower, payload = []) {
  const packet = [0xFC, payload.length + 5, group, flags, cmdUpper, cmdLower, ...payload];
  packet.push(calcCRC8(packet));
  return Buffer.from(packet);
}

function parseStateResponse(payload) {
  if (payload.length < 34) {
    return { error: 'Payload too short', length: payload.length };
  }

  const productId = payload[payload.length - 1];
  const productNames = { 0x01: 'HD', 0x02: '4K', 0x03: 'SideKick', 0x07: 'Solo' };
  const modeNames = ['Sleep', 'Video', 'Music', 'Ambient'];
  const sceneNames = ['Random', 'Fireside', 'Twinkle', 'Ocean', 'Rainbow', 'July4th', 'Holiday', 'Pop', 'Forest'];

  const state = {
    deviceName: payload.slice(0, 16).toString('utf8').replace(/\0/g, '').trim(),
    groupName: payload.slice(16, 32).toString('utf8').replace(/\0/g, '').trim(),
    groupNumber: payload[32],
    mode: payload[33],
    modeName: modeNames[payload[33]] || 'Unknown',
    brightness: payload[34],
    productId: productId,
    productName: productNames[productId] || 'Unknown'
  };

  if (productId === 0x01 || productId === 0x02) {
    if (payload.length > 42) {
      state.ambientColor = { r: payload[40], g: payload[41], b: payload[42] };
    }
    if (payload.length > 62) {
      state.ambientScene = payload[62];
      state.sceneName = sceneNames[payload[62]] || 'Unknown';
    }
    if (payload.length > 73) {
      state.hdmiInput = payload[73];
    }
  } else if (productId === 0x03) {
    if (payload.length > 37) {
      state.ambientColor = { r: payload[35], g: payload[36], b: payload[37] };
    }
    if (payload.length > 60) {
      state.ambientScene = payload[60];
      state.sceneName = sceneNames[payload[60]] || 'Unknown';
    }
  }

  return state;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node test-udp.js <IP_ADDRESS> [command] [value]');
    console.log('');
    console.log('Commands:');
    console.log('  read        Read current device state (default)');
    console.log('  mode N      Set mode (0=sleep, 1=video, 2=music, 3=ambient)');
    console.log('  bright N    Set brightness (0-100)');
    console.log('  scene N     Set scene (0-8)');
    console.log('  color R G B Set color (0-255 each)');
    process.exit(1);
  }

  const ip = args[0];
  const command = args[1] || 'read';
  const value = parseInt(args[2], 10);

  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
    socket.close();
    process.exit(1);
  });

  socket.on('message', (msg, rinfo) => {
    console.log(`\nResponse from ${rinfo.address}:${rinfo.port}`);
    console.log('Raw:', msg.toString('hex'));
    
    if (msg[0] === 0xFC && msg.length > 6) {
      const payload = msg.slice(6, msg.length - 1);
      const state = parseStateResponse(payload);
      console.log('\nParsed state:');
      console.log(JSON.stringify(state, null, 2));
    }
  });

  await new Promise((resolve, reject) => {
    socket.bind(PORT, (err) => {
      if (err) reject(err);
      else {
        socket.setBroadcast(true);
        resolve();
      }
    });
  });

  let packet;

  switch (command) {
    case 'read':
      console.log(`Sending state read request to ${ip}...`);
      packet = buildPacket(0xFF, 0x30, 0x01, 0x0A, []);
      break;

    case 'mode':
      console.log(`Setting mode to ${value} on ${ip}...`);
      packet = buildPacket(0x00, 0x11, 0x03, 0x01, [value]);
      break;

    case 'bright':
    case 'brightness':
      console.log(`Setting brightness to ${value} on ${ip}...`);
      packet = buildPacket(0x00, 0x11, 0x03, 0x02, [value]);
      break;

    case 'scene':
      console.log(`Setting scene to ${value} on ${ip}...`);
      packet = buildPacket(0x00, 0x11, 0x03, 0x0D, [value]);
      break;

    case 'color':
      const r = parseInt(args[2], 10) || 0;
      const g = parseInt(args[3], 10) || 0;
      const b = parseInt(args[4], 10) || 0;
      console.log(`Setting color to RGB(${r}, ${g}, ${b}) on ${ip}...`);
      packet = buildPacket(0x00, 0x11, 0x03, 0x05, [r, g, b]);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      socket.close();
      process.exit(1);
  }

  console.log('Packet:', packet.toString('hex'));

  socket.send(packet, 0, packet.length, PORT, ip, (err) => {
    if (err) {
      console.error('Send error:', err.message);
      socket.close();
      process.exit(1);
    }
    console.log('Packet sent, waiting for response...');
  });

  setTimeout(() => {
    console.log('\nTimeout - no response received (this may be normal for write commands)');
    socket.close();
    process.exit(0);
  }, 3000);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
