#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size, bgRGB, accentRGB) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const T = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    T[i] = c;
  }
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function chunk(type, data) {
    const t = Buffer.from(type, 'ascii');
    const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
    const crcBuf = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crcBuf]);
  }

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const [bgR, bgG, bgB] = bgRGB;
  const [acR, acG, acB] = accentRGB;
  const margin = Math.floor(size * 0.18);

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 3);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const inRect = x >= margin && x < size - margin && y >= margin && y < size - margin;
      const off = 1 + x * 3;
      if (inRect) { row[off] = acR; row[off+1] = acG; row[off+2] = acB; }
      else { row[off] = bgR; row[off+1] = bgG; row[off+2] = bgB; }
    }
    rows.push(row);
  }

  const idat = zlib.deflateSync(Buffer.concat(rows), { level: 6 });
  return Buffer.concat([PNG_SIG, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const bg = [15, 15, 15];
const accent = [232, 93, 4];
const outDir = __dirname;

fs.writeFileSync(path.join(outDir, 'icon-192.png'), createPNG(192, bg, accent));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), createPNG(512, bg, accent));
console.log('✓ Generated icon-192.png and icon-512.png');
