// Turns a sticker design into what the thermal printer will actually put
// down: one ink (black) on the label's own colour, at the print head's
// resolution.
//
// A design, drawn bottom to top:
//   pattern, patternSeed   a generated background (library.js), or "none"
//   layers                 images and text, in order (below)
//   ring                   an edge ring with its white frame, or "none"
//   crop, cropSeed         the cut shape (library.js), or "none" for the label
// Layer positions and sizes are fractions of the sticker's width, so a design
// keeps its look on another label size:
//   { kind: "image", img, x, y, scale, rot }   scale 1 = fits inside the margin
//   { kind: "text", text, font, size, x, y, scale, rot, style }   size = cap height
//     style: "solid", or over a pattern "fill" (pattern carved into the
//     letters) or "cutout" (white letters, outlined)
// x, y are from the centre (y down); rot is in radians.
import { maskPath, drawDesign, designAlphaMask, drawEdgeRing, ringInner } from "./library.js";

// 203 dpi, the usual thermal head: 8 dots per millimetre.
export const DOTS_PER_MM = 8;
const INK = [22, 22, 24];
export const MARGIN_MM = 2;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Die-cut label corners, in mm.
export const CORNER_MM = 1.5;

// The cut outline, w x h in whatever unit `p` draws in: the crop shape, or the
// label's own rounded rectangle.
export function outline(p, { w, h, crop, cropSeed }, unitsPerMm) {
  if (crop && crop !== "none" && maskPath(crop, w, h, cropSeed, p)) return p;
  const r = CORNER_MM * unitsPerMm;
  p.moveTo(r, 0);
  p.lineTo(w - r, 0);
  p.arc(w - r, r, r, -Math.PI / 2, 0);
  p.lineTo(w, h - r);
  p.arc(w - r, h - r, r, 0, Math.PI / 2);
  p.lineTo(r, h);
  p.arc(r, h - r, r, Math.PI / 2, Math.PI);
  p.lineTo(0, r);
  p.arc(r, r, r, Math.PI, Math.PI * 1.5);
  p.closePath();
  return p;
}

// The circle artwork sits inside on a shaped or ringed sticker, in mm across.
function innerCircle({ w, h, crop, ring }) {
  const inner = ringInner(ring);
  if (inner) return Math.min(w, h) * 0.96 * 1.03 * (inner - 0.02);
  if (crop && crop !== "none") return Math.min(w, h) * 0.96 * 0.94;
  return 0;
}

const fontOf = (layer, px) => `${layer.weight || 700} ${px}px "${layer.font}"`;
let measurer = null;

// A layer's unscaled, unrotated size in mm on a sticker { w, h, shape }.
export function layerBase(layer, sticker) {
  const { w, h } = sticker;
  if (layer.kind === "image") {
    const aspect = layer.img.naturalWidth / layer.img.naturalHeight;
    const d = innerCircle(sticker);
    if (d) {
      // Fit by the diagonal, so the corners stay inside the circle.
      const bh = d / Math.sqrt(aspect * aspect + 1);
      return { bw: bh * aspect, bh };
    }
    let bw = w - 2 * MARGIN_MM, bh = h - 2 * MARGIN_MM;
    if (bw / bh > aspect) bw = bh * aspect;
    else bh = bw / aspect;
    return { bw, bh };
  }
  measurer ||= document.createElement("canvas").getContext("2d");
  const px = 100;
  measurer.font = fontOf(layer, px);
  const lines = layer.text.split("\n");
  const widest = Math.max(1, ...lines.map((t) => measurer.measureText(t).width));
  const size = layer.size * w; // mm
  return { bw: (widest / px) * size, bh: lines.length * size * 1.15 };
}

// Size on the sticker, in mm, after the layer's own scale.
export function layerSize(layer, sticker) {
  const { bw, bh } = layerBase(layer, sticker);
  return { lw: bw * layer.scale, lh: bh * layer.scale };
}

// Draws a text layer's lines, centred on the current origin.
function textLines(ctx, layer, size, draw) {
  const lines = layer.text.split("\n");
  ctx.font = fontOf(layer, size);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((t, i) => draw(t, (i - (lines.length - 1) / 2) * size * 1.15));
}

// Returns a canvas the size of the sticker in print dots. Inside the shape is
// paper and ink; outside it is transparent.
export function renderThermal(design, { w, h, mode, threshold, invert, paper }) {
  const { layers, pattern = "none", patternSeed = 1, ring = "none", crop = "none", cropSeed = 1 } = design;
  const sticker = { w, h, crop, ring };
  const W = Math.max(1, Math.round(w * DOTS_PER_MM));
  const H = Math.max(1, Math.round(h * DOTS_PER_MM));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const hasPattern = pattern !== "none";
  const ringKey = ring === "none" ? null : ring;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  if (hasPattern) drawDesign(ctx, W, H, pattern, patternSeed, ringKey);

  const D = DOTS_PER_MM;
  let patternMask = null;
  for (const layer of layers) {
    const { lw, lh } = layerSize(layer, sticker);
    const place = (g) => {
      g.translate((w / 2 + layer.x * w) * D, (h / 2 + layer.y * w) * D);
      g.rotate(layer.rot);
    };
    ctx.save();
    if (layer.kind === "image") {
      place(ctx);
      ctx.drawImage(layer.img, (-lw / 2) * D, (-lh / 2) * D, lw * D, lh * D);
    } else {
      const size = layer.size * w * layer.scale * D;
      const style = hasPattern ? layer.style || "solid" : "solid";
      if (style === "fill") {
        // Solid letters with the pattern carved out of them.
        const t = document.createElement("canvas");
        t.width = W;
        t.height = H;
        const tg = t.getContext("2d");
        place(tg);
        tg.fillStyle = "#000";
        textLines(tg, layer, size, (line, y) => tg.fillText(line, 0, y));
        tg.setTransform(1, 0, 0, 1, 0, 0);
        tg.globalCompositeOperation = "destination-out";
        patternMask ||= designAlphaMask(W, H, pattern, patternSeed, ringKey);
        tg.drawImage(patternMask, 0, 0);
        // Over a white base, so the carved lines read as paper.
        place(ctx);
        textLines(ctx, layer, size, (line, y) => {
          ctx.fillStyle = "#fff";
          ctx.fillText(line, 0, y);
        });
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(t, 0, 0);
      } else {
        place(ctx);
        textLines(ctx, layer, size, (line, y) => {
          if (style === "cutout") {
            ctx.lineWidth = Math.max(2, Math.min(W, H) * 0.01);
            ctx.strokeStyle = "#000";
            ctx.lineJoin = "round";
            ctx.strokeText(line, 0, y);
            ctx.fillStyle = "#fff";
          } else {
            ctx.fillStyle = "#000";
          }
          ctx.fillText(line, 0, y);
        });
      }
    }
    ctx.restore();
  }

  if (ringKey) drawEdgeRing(ctx, W, H, ringKey, null);

  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  const grey = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const g = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    grey[i] = invert ? 255 - g : g;
  }

  const inked = new Uint8Array(W * H);
  if (mode === "dither") {
    // Floyd-Steinberg, nudged by the threshold slider so it still means
    // "darker / lighter".
    const bias = threshold - 128;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const old = grey[i];
        const on = old < 128 + bias;
        inked[i] = on ? 1 : 0;
        const err = old - (on ? 0 : 255);
        if (x + 1 < W) grey[i + 1] += (err * 7) / 16;
        if (y + 1 < H) {
          if (x > 0) grey[i + W - 1] += (err * 3) / 16;
          grey[i + W] += (err * 5) / 16;
          if (x + 1 < W) grey[i + W + 1] += err / 16;
        }
      }
    }
  } else {
    for (let i = 0; i < W * H; i++) inked[i] = grey[i] < threshold ? 1 : 0;
  }

  const p = hexToRgb(paper);
  for (let i = 0; i < W * H; i++) {
    const c = inked[i] ? INK : p;
    px[i * 4] = c[0];
    px[i * 4 + 1] = c[1];
    px[i * 4 + 2] = c[2];
    px[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);

  // Cut to the shape.
  ctx.globalCompositeOperation = "destination-in";
  ctx.fill(outline(new Path2D(), { w: W, h: H, crop, cropSeed }, D));
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}
