/**
 * Generates the PWA icon set with no image dependencies.
 *
 * The mark is a disc cut by a diagonal gap, the two halves pushed apart along the cut —
 * "one thing, divided". Everything is drawn from signed distance fields and supersampled 4x,
 * so the curves stay clean at 180px and at 512px.
 *
 * Run: node scripts/generate-icons.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const GROUND = [0x1e, 0x6b, 0x61];
const MARK = [0xea, 0xf1, 0xee];
const SS = 4; // supersampling factor

// ---------- PNG encoding ----------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

function encodePng(size, pixels) {
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// ---------- geometry (signed distance fields; negative = inside) ----------

function sdRoundedRect(px, py, cx, cy, half, radius) {
  const qx = Math.abs(px - cx) - (half - radius);
  const qy = Math.abs(py - cy) - (half - radius);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - radius;
}

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

/**
 * @param size      output pixel size
 * @param markScale mark diameter as a fraction of the canvas (smaller for maskable safe zone)
 * @param cornerPct ground corner radius as a fraction of size; 0.5 would be a circle
 */
function drawIcon(size, markScale, cornerPct) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const markR = (size * markScale) / 2;

  // Diagonal cut running bottom-left to top-right.
  const angle = -Math.PI / 4;
  const nx = Math.cos(angle + Math.PI / 2);
  const ny = Math.sin(angle + Math.PI / 2);
  const gap = size * 0.055;
  const offset = size * 0.022;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS;
          const fy = y + (sy + 0.5) / SS;

          const inGround = sdRoundedRect(fx, fy, c, c, size / 2, size * cornerPct) < 0;
          if (!inGround) continue;

          // Which side of the cut, and how far from it.
          const d = (fx - c) * nx + (fy - c) * ny;
          let onMark = false;
          if (d < -gap / 2) {
            // Upper half, nudged away from the cut.
            onMark = sdCircle(fx + nx * offset, fy + ny * offset, c, c, markR) < 0;
          } else if (d > gap / 2) {
            onMark = sdCircle(fx - nx * offset, fy - ny * offset, c, c, markR) < 0;
          }

          const [pr, pg, pb] = onMark ? MARK : GROUND;
          r += pr; g += pg; b += pb; a += 255;
        }
      }

      const n = SS * SS;
      const i = (y * size + x) * 4;
      if (a === 0) {
        px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
      } else {
        // Un-premultiply against coverage so edges blend to transparent, not to black.
        const cov = a / (n * 255);
        px[i] = Math.round(r / (n * cov));
        px[i + 1] = Math.round(g / (n * cov));
        px[i + 2] = Math.round(b / (n * cov));
        px[i + 3] = Math.round(a / n);
      }
    }
  }
  return encodePng(size, px);
}

mkdirSync("public/icons", { recursive: true });

const outputs = [
  // Square-ish ground: the OS applies its own mask on top.
  ["public/icons/icon-192.png", 192, 0.58, 0.22],
  ["public/icons/icon-512.png", 512, 0.58, 0.22],
  // apple-touch-icon: iOS rounds it itself, so the ground is full bleed.
  ["public/icons/apple-touch-icon.png", 180, 0.58, 0.0],
  // Maskable: mark stays inside the 80% safe zone, ground fills the whole canvas.
  ["public/icons/icon-maskable-512.png", 512, 0.42, 0.0],
  ["public/icons/icon-maskable-192.png", 192, 0.42, 0.0],
  // Favicon.
  ["public/icons/favicon-32.png", 32, 0.62, 0.18]
];

for (const [path, size, markScale, cornerPct] of outputs) {
  writeFileSync(path, drawIcon(size, markScale, cornerPct));
  console.log(`wrote ${path} (${size}x${size})`);
}
