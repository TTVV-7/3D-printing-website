// Turns a sticker design into what the thermal printer will actually put
// down: one ink (black) on the label's own colour, at the print head's
// resolution.
//
// A design is a list of layers, drawn in order. Positions and sizes are
// fractions of the sticker's width, so a design keeps its look when the
// sticker is resized:
//   { kind: "image", img, x, y, scale, rot }   scale 1 = fits inside the margin
//   { kind: "text", text, font, size, x, y, scale, rot }   size = cap height
// x, y are from the centre (y down); rot is in radians.

// 203 dpi, the usual thermal head: 8 dots per millimetre.
export const DOTS_PER_MM = 8;
const INK = [22, 22, 24];
export const MARGIN_MM = 2;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Width and height in mm for a sticker of `widthMm` across. Circles are as
// tall as they are wide; the others follow the first image, or are 2:1 for
// text alone.
export function stickerSize(layers, widthMm, shape) {
  if (shape === "circle") return { w: widthMm, h: widthMm };
  const img = layers.find((l) => l.kind === "image")?.img;
  const aspect = img ? img.naturalWidth / img.naturalHeight : 2;
  return { w: widthMm, h: Math.round((widthMm / aspect) * 10) / 10 };
}

export function shapePath(ctx, w, h, shape) {
  ctx.beginPath();
  if (shape === "circle") ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
  else if (shape === "rounded") ctx.roundRect(0, 0, w, h, Math.min(w, h) * 0.12);
  else ctx.rect(0, 0, w, h);
}

const fontOf = (layer, px) => `${layer.weight || 700} ${px}px "${layer.font}"`;
let measurer = null;

// A layer's unscaled, unrotated size in mm on a sticker { w, h, shape }.
export function layerBase(layer, { w, h, shape }) {
  if (layer.kind === "image") {
    const aspect = layer.img.naturalWidth / layer.img.naturalHeight;
    if (shape === "circle") {
      // Fit by the diagonal, so the corners stay inside the circle.
      const bh = (w - 2 * MARGIN_MM) / Math.sqrt(aspect * aspect + 1);
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

// Returns a canvas the size of the sticker in print dots. Inside the shape is
// paper and ink; outside it is transparent.
export function renderThermal(layers, { w, h, shape, mode, threshold, invert, paper }) {
  const W = Math.max(1, Math.round(w * DOTS_PER_MM));
  const H = Math.max(1, Math.round(h * DOTS_PER_MM));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  const D = DOTS_PER_MM;
  for (const layer of layers) {
    const { lw, lh } = layerSize(layer, { w, h, shape });
    ctx.save();
    ctx.translate((w / 2 + layer.x * w) * D, (h / 2 + layer.y * w) * D);
    ctx.rotate(layer.rot);
    if (layer.kind === "image") {
      ctx.drawImage(layer.img, (-lw / 2) * D, (-lh / 2) * D, lw * D, lh * D);
    } else {
      const lines = layer.text.split("\n");
      const size = layer.size * w * layer.scale * D;
      ctx.font = fontOf(layer, size);
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      lines.forEach((t, i) => ctx.fillText(t, 0, (i - (lines.length - 1) / 2) * size * 1.15));
    }
    ctx.restore();
  }

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
  shapePath(ctx, W, H, shape);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}
