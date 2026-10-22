// Turns a sticker design into what the thermal printer will actually put
// down: one ink (black) on the label's own colour, at the print head's
// resolution.
//
// A design, drawn bottom to top:
//   pattern, patternSeed   a generated background (library.js), or "none"
//   layers                 images, text and routes (route.js), in order (below)
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
import { drawRoute } from "./route.js";

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
  if (layer.kind === "image" || layer.kind === "route") {
    const aspect = layer.kind === "route" ? layer.aspect : layer.img.naturalWidth / layer.img.naturalHeight;
    const d = innerCircle(sticker);
    if (d) {
      // The longer side spans the circle: artwork's corners are usually
      // blank, and fitting by the diagonal left it looking lost.
      const side = d * 0.95;
      return aspect >= 1 ? { bw: side, bh: side / aspect } : { bw: side * aspect, bh: side };
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
  const size = textSizeMm(layer, sticker);
  return { bw: (widest / px) * size, bh: lines.length * size * 1.15 };
}

// A text layer's letter size in mm before its own scale: what was asked
// for, shrunk so the longest line fits across the sticker (inside the circle
// on round labels and rings).
function textSizeMm(layer, sticker) {
  const { w } = sticker;
  measurer ||= document.createElement("canvas").getContext("2d");
  measurer.font = fontOf(layer, 100);
  const widest = Math.max(1, ...layer.text.split("\n").map((t) => measurer.measureText(t).width)) / 100;
  const d = innerCircle(sticker);
  let size = Math.min(layer.size * w, ((d || w - 2 * MARGIN_MM) * 0.9) / widest);
  if (d) {
    // In a circle, fit the width of the circle where the text sits: the
    // chord through its farthest edge from the centre.
    const r = d / 2, y = Math.abs(layer.y * w), lines = layer.text.split("\n").length;
    for (let i = 0; i < 6; i++) {
      const edge = Math.min(r, y + (size * 1.15 * lines) / 2);
      size = Math.min(size, (2 * Math.sqrt(r * r - edge * edge) * 0.92) / widest);
    }
  }
  return Math.max(size, 0.5);
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

// Big uploads shrunk straight to print size in one step alias: edges come out
// ragged and thin lines drop out once the dots are thresholded. This halves
// them a step at a time with high-quality smoothing first, as the in-shop
// Sticker Printer app does, and keeps the result for the next redraw.
const shrunk = new WeakMap();
function smoothScaled(img, width, height) {
  const tw = Math.max(1, Math.round(width)), th = Math.max(1, Math.round(height));
  let cw = img.naturalWidth || img.width, ch = img.naturalHeight || img.height;
  if (cw <= tw * 2 && ch <= th * 2) return img;
  const key = `${tw}x${th}`;
  const hit = shrunk.get(img);
  if (hit?.key === key) return hit.canvas;
  let cur = img;
  while (cw > tw * 2 || ch > th * 2) {
    cw = Math.max(tw, Math.round(cw / 2));
    ch = Math.max(th, Math.round(ch / 2));
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(cur, 0, 0, cw, ch);
    cur = c;
  }
  shrunk.set(img, { key, canvas: cur });
  return cur;
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

  // Where photos show in the finished sticker. Only they get the photo
  // treatment (dots, the darkness slider); designs, rings and text are
  // already black and white and are cut clean, as the in-shop app prints them.
  const photo = document.createElement("canvas");
  photo.width = W;
  photo.height = H;
  const pg = photo.getContext("2d", { willReadFrequently: true });

  const D = DOTS_PER_MM;
  let patternMask = null;
  for (const layer of layers) {
    const { lw, lh } = layerSize(layer, sticker);
    const place = (g) => {
      g.translate((w / 2 + layer.x * w) * D, (h / 2 + layer.y * w) * D);
      g.rotate(layer.rot);
    };
    ctx.save();
    pg.save();
    if (layer.kind === "route") {
      // Crisp black like text, with a white edge over a pattern.
      const s = (layer.aspect >= 1 ? lw : lh) * D;
      place(ctx);
      drawRoute(ctx, layer, s, D, hasPattern);
      place(pg);
      pg.globalCompositeOperation = "destination-out";
      drawRoute(pg, { ...layer, width: layer.width + 1.4 }, s, D, false);
    } else if (layer.kind === "image") {
      const src = smoothScaled(layer.img, lw * D, lh * D);
      place(ctx);
      // Multiply: an image's white shows the design under it, like paper.
      ctx.globalCompositeOperation = "multiply";
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, (-lw / 2) * D, (-lh / 2) * D, lw * D, lh * D);
      place(pg);
      pg.imageSmoothingQuality = "high";
      pg.drawImage(src, (-lw / 2) * D, (-lh / 2) * D, lw * D, lh * D);
    } else {
      // Text over a photo is crisp, not dotted.
      place(pg);
      pg.globalCompositeOperation = "destination-out";
      pg.lineWidth = Math.max(2, Math.min(W, H) * 0.01);
      textLines(pg, layer, textSizeMm(layer, sticker) * layer.scale * D, (line, y) => {
        pg.fillText(line, 0, y);
        pg.strokeText(line, 0, y);
      });
      const size = textSizeMm(layer, sticker) * layer.scale * D;
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
    pg.restore();
  }

  if (ringKey) {
    drawEdgeRing(ctx, W, H, ringKey, null);
    // The ring and its white frame cover whatever photo was under them.
    const R = (Math.min(W, H) / 2) * 0.96 * 1.03;
    pg.globalCompositeOperation = "destination-out";
    pg.beginPath();
    pg.rect(0, 0, W, H);
    pg.arc(W / 2, H / 2, ringInner(ringKey) * R, 0, Math.PI * 2);
    pg.fill("evenodd");
  }
  // A photo pixel is one with some of the image's own ink in it; its plain
  // white stays out, so the design showing through it stays crisp.
  const isPhoto = pg.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) {
    const j = i * 4;
    if (isPhoto[j] + isPhoto[j + 1] + isPhoto[j + 2] > 735) isPhoto[j + 3] = 0;
  }

  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  const grey = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const g = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    grey[i] = invert ? 255 - g : g;
  }

  const inked = new Uint8Array(W * H);
  const photoAt = (i) => isPhoto[i * 4 + 3] > 0;
  // Everything but photos: a clean cut at mid-grey.
  for (let i = 0; i < W * H; i++) if (!photoAt(i)) inked[i] = grey[i] < 128 ? 1 : 0;
  if (mode === "dither") {
    // Floyd-Steinberg over the photos only, nudged by the darkness slider so
    // it still means "darker / lighter".
    const bias = threshold - 128;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!photoAt(i)) continue;
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
    for (let i = 0; i < W * H; i++) if (photoAt(i)) inked[i] = grey[i] < threshold ? 1 : 0;
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

// The same sticker for the screen. On paper the dots blend into smooth edges,
// but shown big a 203 dpi bitmap looks jagged or soft. This enlarges it
// smoothly and cuts it back to ink and paper, so edges stay sharp at any zoom
// while every dot pattern (and the print file) stays exactly as printed.
export function previewArt(art, paper) {
  const k = Math.max(1, Math.min(4, Math.floor(2048 / Math.max(art.width, art.height))));
  const c = document.createElement("canvas");
  c.width = art.width * k;
  c.height = art.height * k;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingQuality = "high";
  g.drawImage(art, 0, 0, c.width, c.height);
  if (k === 1) return c;
  const im = g.getImageData(0, 0, c.width, c.height);
  const px = im.data;
  const p = hexToRgb(paper);
  const lum = (r, gr, b) => 0.299 * r + 0.587 * gr + 0.114 * b;
  const mid = (lum(...INK) + lum(...p)) / 2;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const c2 = lum(px[i], px[i + 1], px[i + 2]) < mid ? INK : p;
    px[i] = c2[0];
    px[i + 1] = c2[1];
    px[i + 2] = c2[2];
  }
  g.putImageData(im, 0, 0);
  return c;
}

// The file to print: the sticker as pure black dots on white, label-sized at
// 203 dpi (1 pixel = 1 print dot), with no label colour and nothing
// see-through, ready for the in-shop app's "Fit" and "Print".
export function printFile(art) {
  const c = document.createElement("canvas");
  c.width = art.width;
  c.height = art.height;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(art, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height);
  const px = im.data;
  for (let i = 0; i < px.length; i += 4) {
    const v = px[i] + px[i + 1] + px[i + 2] < 300 ? 0 : 255; // ink is near-black; every label colour is light
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c.toDataURL("image/png");
}
