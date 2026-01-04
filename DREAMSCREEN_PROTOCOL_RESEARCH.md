# DreamScreen UDP Protocol: Implementation Reference

## Protocol Overview

DreamScreen devices communicate via **UDP port 8888** using a binary packet format with CRC8 validation.

### Packet Structure

```
[Start] [Length] [Group] [Flags] [Cmd Upper] [Cmd Lower] [Payload...] [CRC8]
0xFC    1 byte   1 byte  1 byte  1 byte      1 byte      Variable     1 byte
```

| Field | Size | Description |
|-------|------|-------------|
| Start | 1 | Always `0xFC` |
| Length | 1 | `5 + payload_length` (bytes from Group to CRC) |
| Group | 1 | `0x00` (no group), `0x01-0x03` (groups 1-3), `0xFF` (broadcast) |
| Flags | 1 | `0x11` (write), `0x30` (read state) |
| Cmd Upper | 1 | Command namespace (usually `0x03`) |
| Cmd Lower | 1 | Specific command |
| Payload | Variable | Command data |
| CRC8 | 1 | CRC8 checksum |

---

## Write Commands (Flags: `0x11`)

All write commands use `Cmd Upper = 0x03`:

| Command | Cmd Lower | Payload | Values |
|---------|-----------|---------|--------|
| Mode | `0x01` | 1 byte | 0=Sleep, 1=Video, 2=Music, 3=Ambient |
| Brightness | `0x02` | 1 byte | 0-100 |
| Color | `0x05` | 3 bytes | R, G, B (0-255 each) |
| Ambience Type | `0x08` | 1 byte | 0=Color, 1=Scene |
| Scene | `0x0D` | 1 byte | 0-8 (see below) |
| HDMI Input | `0x20` | 1 byte | 0-2 (inputs 1-3) |

### Ambient Scenes

| Value | Scene |
|-------|-------|
| 0 | Random Color |
| 1 | Fireside |
| 2 | Twinkle |
| 3 | Ocean |
| 4 | Rainbow |
| 5 | July 4th |
| 6 | Holiday |
| 7 | Pop |
| 8 | Enchanted Forest |

---

## Read State Command

### Request

Send to device IP or broadcast (`255.255.255.255`):

```
FC 05 FF 30 01 0A [CRC]
```

- Group: `0xFF` (broadcast)
- Flags: `0x30` (read state)
- Cmd Upper: `0x01`
- Cmd Lower: `0x0A`

### Response Payload Structure

Response payload varies by device type. Product ID is always the **last byte**.

#### DreamScreen HD (0x01) and 4K (0x02)

| Offset | Field | Size |
|--------|-------|------|
| 0-15 | Device Name | 16 bytes (null-padded UTF-8) |
| 16-31 | Group Name | 16 bytes |
| 32 | Group Number | 1 byte |
| 33 | Mode | 1 byte |
| 34 | Brightness | 1 byte |
| 40-42 | Ambient Color | 3 bytes (RGB) |
| 62 | Ambient Scene | 1 byte |
| 73 | HDMI Input | 1 byte |
| Last | Product ID | 1 byte |

#### SideKick (0x03)

| Offset | Field | Size |
|--------|-------|------|
| 0-31 | Same as HD/4K | - |
| 32-34 | Same as HD/4K | - |
| 35-37 | Ambient Color | 3 bytes (RGB) |
| 60 | Ambient Scene | 1 byte |
| Last | Product ID | 1 byte |

---

## CRC8 Calculation

Uses a 256-byte lookup table. Calculate over bytes 0 through (Length+1):

```javascript
calcCRC8(data) {
  let crc = 0;
  const size = data[1] + 1;
  for (let i = 0; i < size && i < data.length; i++) {
    crc = CRC_TABLE[(data[i] ^ crc) & 0xFF];
  }
  return crc;
}
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `lib/DreamScreenUDP.js` | UDP client with send/receive, polling |
| `lib/DreamScreenState.js` | State cache with payload parsing |
| `index.js` | Homebridge accessory with HomeKit integration |

---

## Example Packets

### Set Mode to Video

```
FC 06 00 11 03 01 01 [CRC]
       │  │  │  │  └─ Payload: mode=1 (Video)
       │  │  │  └──── Cmd Lower: 0x01 (Mode)
       │  │  └─────── Cmd Upper: 0x03
       │  └────────── Flags: 0x11 (write)
       └───────────── Group: 0 (no group)
```

### Set Brightness to 75%

```
FC 06 00 11 03 02 4B [CRC]
                  └─ Payload: 75 (0x4B)
```

### Set Color to Red

```
FC 08 00 11 03 05 FF 00 00 [CRC]
                  └────── Payload: RGB(255, 0, 0)
```

### Read State Request

```
FC 05 FF 30 01 0A [CRC]
```

---

## References

- [pydreamscreen](https://github.com/J3n50m4t/pydreamscreen) - Python reference implementation
- [dreamscreen-tools](https://github.com/cboyer/dreamscreen-tools) - C implementation
- [DreamScreenCommander](https://github.com/genesisfactor/DreamScreenCommander) - Original Python script
