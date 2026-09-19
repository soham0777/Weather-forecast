// Generates the PWA PNG icon set (regular + maskable + favicon + apple-touch-icon)
// from scratch — no image libraries, just a minimal hand-rolled PNG encoder.
// Usage: node scripts/gen-icons.js icons/
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function lerp(a, b, t) { return a + (b - a) * t; }

function makeIcon(size, maskable) {
  const px = new Uint8ClampedArray(size * size * 4);
  const cx = size / 2, cy = size / 2;
  // safe zone padding for maskable icons (~10%)
  const pad = maskable ? size * 0.08 : 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const t = (x + y) / (size * 2);
      // deep indigo -> violet -> sky gradient background
      let r = lerp(30, 56, t);
      let g = lerp(41, 120, t);
      let b = lerp(94, 220, t);

      // rounded square mask (only for non-maskable "any" icon)
      if (!maskable) {
        const radius = size * 0.22;
        const dx = Math.max(0, Math.abs(x - cx) - (size / 2 - radius));
        const dy = Math.max(0, Math.abs(y - cy) - (size / 2 - radius));
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) {
          px[idx] = 0; px[idx + 1] = 0; px[idx + 2] = 0; px[idx + 3] = 0;
          continue;
        }
      }

      px[idx] = r; px[idx + 1] = g; px[idx + 2] = b; px[idx + 3] = 255;
    }
  }

  const usable = size - pad * 2;
  const gcx = cx, gcy = cy + usable * 0.02;

  // sun: glowing circle upper-right of glyph area
  const sunCx = gcx + usable * 0.16;
  const sunCy = gcy - usable * 0.20;
  const sunR = usable * 0.20;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - sunCx, dy = y - sunCy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < sunR * 1.35) {
        const idx = (y * size + x) * 4;
        let a = 0;
        if (d < sunR) a = 1;
        else a = Math.max(0, 1 - (d - sunR) / (sunR * 0.35));
        const yellow = [255, 205, 92];
        px[idx] = lerp(px[idx], yellow[0], a);
        px[idx + 1] = lerp(px[idx + 1], yellow[1], a);
        px[idx + 2] = lerp(px[idx + 2], yellow[2], a);
      }
    }
  }

  // cloud: three overlapping ellipses, white, soft shadow
  const cloudCx = gcx - usable * 0.02;
  const cloudCy = gcy + usable * 0.12;
  const lobes = [
    { dx: -0.22, dy: 0.03, rx: 0.20, ry: 0.16 },
    { dx: 0.02, dy: -0.05, rx: 0.26, ry: 0.21 },
    { dx: 0.24, dy: 0.04, rx: 0.19, ry: 0.15 },
    { dx: 0.0, dy: 0.10, rx: 0.34, ry: 0.14 },
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = false;
      for (const l of lobes) {
        const ex = cloudCx + usable * l.dx;
        const ey = cloudCy + usable * l.dy;
        const rx = usable * l.rx, ry = usable * l.ry;
        const nx = (x - ex) / rx, ny = (y - ey) / ry;
        if (nx * nx + ny * ny <= 1) { inside = true; break; }
      }
      if (inside) {
        const idx = (y * size + x) * 4;
        px[idx] = 255; px[idx + 1] = 255; px[idx + 2] = 255;
        if (px[idx + 3] === 0) px[idx + 3] = 255;
      }
    }
  }

  return px;
}

function encodePNG(px, size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const srcIdx = (y * size + x) * 4;
      const dstIdx = y * (size * 4 + 1) + 1 + x * 4;
      raw[dstIdx] = px[srcIdx];
      raw[dstIdx + 1] = px[srcIdx + 1];
      raw[dstIdx + 2] = px[srcIdx + 2];
      raw[dstIdx + 3] = px[srcIdx + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = process.argv[2];
const sizes = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['maskable-192.png', 192, true],
  ['maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
  ['favicon-32.png', 32, false],
];

for (const [name, size, maskable] of sizes) {
  const px = makeIcon(size, maskable);
  const png = encodePNG(px, size);
  fs.writeFileSync(path.join(outDir, name), png);
  console.log('wrote', name, png.length, 'bytes');
}
