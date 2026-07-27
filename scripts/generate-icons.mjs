#!/usr/bin/env node
/**
 * Generates the PWA icon set.
 *
 * The mark is drawn programmatically (an open book on the accent colour) so
 * the icons are reproducible from source and no binary editor is needed.
 * Run with `node scripts/generate-icons.mjs` after changing the palette.
 */

import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'icons');

const INK = [36, 66, 92, 255]; // accent-strong
const PAPER = [250, 249, 247, 255];
const LINE = [154, 168, 182, 255];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // no filter
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function createCanvas(size) {
  const pixels = Buffer.alloc(size * size * 4);
  return {
    size,
    pixels,
    set(x, y, colour) {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      const offset = (y * size + x) * 4;
      pixels[offset] = colour[0];
      pixels[offset + 1] = colour[1];
      pixels[offset + 2] = colour[2];
      pixels[offset + 3] = colour[3];
    },
    fill(colour) {
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) this.set(x, y, colour);
      }
    },
    rect(x0, y0, x1, y1, colour, radius = 0) {
      for (let y = Math.round(y0); y < Math.round(y1); y += 1) {
        for (let x = Math.round(x0); x < Math.round(x1); x += 1) {
          if (radius > 0) {
            const dx = Math.min(x - x0, x1 - 1 - x);
            const dy = Math.min(y - y0, y1 - 1 - y);
            if (dx < radius && dy < radius) {
              const distance = Math.hypot(radius - dx, radius - dy);
              if (distance > radius) continue;
            }
          }
          this.set(x, y, colour);
        }
      }
    },
  };
}

function drawIcon(size, { padding }) {
  const canvas = createCanvas(size);
  canvas.fill(INK);

  const inset = size * padding;
  const width = size - inset * 2;
  const height = width * 0.74;
  const top = (size - height) / 2;
  const left = inset;
  const radius = size * 0.03;

  // Two facing pages with a gap for the spine.
  const gap = size * 0.022;
  const pageWidth = (width - gap) / 2;

  canvas.rect(left, top, left + pageWidth, top + height, PAPER, radius);
  canvas.rect(
    left + pageWidth + gap,
    top,
    left + width,
    top + height,
    PAPER,
    radius,
  );

  // Ruled lines suggesting text, shorter towards the bottom of each page.
  const lineCount = 5;
  const lineHeight = Math.max(2, size * 0.018);
  const lineGap = (height - lineHeight * lineCount) / (lineCount + 1.4);

  for (let index = 0; index < lineCount; index += 1) {
    const y = top + lineGap * (index + 1) + lineHeight * index;
    const shrink = index === lineCount - 1 ? 0.45 : 1;
    const runWidth = (pageWidth - size * 0.09) * shrink;

    canvas.rect(
      left + size * 0.045,
      y,
      left + size * 0.045 + runWidth,
      y + lineHeight,
      LINE,
    );
    canvas.rect(
      left + pageWidth + gap + size * 0.045,
      y,
      left + pageWidth + gap + size * 0.045 + runWidth,
      y + lineHeight,
      LINE,
    );
  }

  return canvas;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const targets = [
    { file: 'icon-192.png', size: 192, padding: 0.14 },
    { file: 'icon-512.png', size: 512, padding: 0.14 },
    // Maskable icons need their content inside the central safe zone.
    { file: 'icon-512-maskable.png', size: 512, padding: 0.24 },
    { file: 'apple-touch-icon.png', size: 180, padding: 0.14 },
  ];

  for (const target of targets) {
    const canvas = drawIcon(target.size, { padding: target.padding });
    await writeFile(
      path.join(OUT_DIR, target.file),
      encodePng(target.size, target.size, canvas.pixels),
    );
    console.log(`wrote public/icons/${target.file}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
