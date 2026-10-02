// Builds public/topo/north-shore.bin, the terrain behind the intro screen
// (src/components/TopoScene.js). Run once; the output is committed.
//
//   node scripts/topo-heightmap.mjs
//
// Elevation comes from the open AWS Terrain Tiles (Terrarium encoding, sourced
// from SRTM / CDEM and others). Output format: uint16 width, uint16 height
// (little-endian), then width*height bytes, rows top to bottom, where
// metres = byte * 7 - 20.
import { writeFile, mkdir } from "node:fs/promises";
import { inflateSync } from "node:zlib";

// North Shore Mountains: Cypress to Seymour, Burrard Inlet along the bottom.
const BOUNDS = { west: -123.29, east: -122.88, south: 49.28, north: 49.47 };
const ZOOM = 12;
const OUT_WIDTH = 320;
// Heights are stored as one byte: metres = byte * STEP + MIN.
const STEP = 7, MIN = -20;

const lon2x = (lon) => ((lon + 180) / 360) * 2 ** ZOOM;
const lat2y = (lat) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** ZOOM;
};

// Minimal decoder for 8-bit RGB, non-interlaced PNGs (what the tiles are).
function decodePng(buf) {
  let pos = 8, width = 0, height = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 2 || data[12] !== 0) throw new Error("unexpected PNG format");
    } else if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 3, stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  return { width, height, data: out };
}

const x0 = lon2x(BOUNDS.west), x1 = lon2x(BOUNDS.east);
const y0 = lat2y(BOUNDS.north), y1 = lat2y(BOUNDS.south);
const tiles = new Map();
for (let tx = Math.floor(x0); tx <= Math.floor(x1); tx++) {
  for (let ty = Math.floor(y0); ty <= Math.floor(y1); ty++) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}/${tx}/${ty}.png`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    tiles.set(`${tx}/${ty}`, decodePng(Buffer.from(await res.arrayBuffer())));
    console.log("tile", tx, ty);
  }
}

function elevation(tileX, tileY) {
  const tx = Math.floor(tileX), ty = Math.floor(tileY);
  const t = tiles.get(`${tx}/${ty}`);
  const px = Math.min(255, Math.floor((tileX - tx) * 256));
  const py = Math.min(255, Math.floor((tileY - ty) * 256));
  const i = (py * 256 + px) * 3;
  return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
}

// Box-filter each output cell so the coarse grid doesn't alias.
const outH = Math.round((OUT_WIDTH * (y1 - y0)) / (x1 - x0));
const out = Buffer.alloc(4 + OUT_WIDTH * outH);
out.writeUInt16LE(OUT_WIDTH, 0);
out.writeUInt16LE(outH, 2);
const S = 3;
for (let y = 0; y < outH; y++) {
  for (let x = 0; x < OUT_WIDTH; x++) {
    let sum = 0;
    for (let sy = 0; sy < S; sy++) {
      for (let sx = 0; sx < S; sx++) {
        const tX = x0 + ((x + (sx + 0.5) / S) / OUT_WIDTH) * (x1 - x0);
        const tY = y0 + ((y + (sy + 0.5) / S) / outH) * (y1 - y0);
        sum += elevation(tX, tY);
      }
    }
    // Flatten the sea floor so the coastline reads as one clean contour.
    const m = Math.max(MIN, sum / (S * S));
    out[4 + y * OUT_WIDTH + x] = Math.min(255, Math.round((m - MIN) / STEP));
  }
}

await mkdir(new URL("../public/topo/", import.meta.url), { recursive: true });
await writeFile(new URL("../public/topo/north-shore.bin", import.meta.url), out);
console.log(`wrote public/topo/north-shore.bin (${OUT_WIDTH}x${outH})`);
