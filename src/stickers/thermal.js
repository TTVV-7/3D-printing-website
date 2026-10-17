// Turns any image into what the thermal printer will actually put down: one
// ink (black) on the label's own colour, at the print head's resolution.

// 203 dpi, the usual thermal head: 8 dots per millimetre.
export const DOTS_PER_MM = 8;
const INK = [22, 22, 24];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Width and height in mm for a sticker of `widthMm` across. Circles are as
// tall as they are wide; the others follow the image.
export function stickerSize(img, widthMm, shape) {
  if (shape === "circle") return { w: widthMm, h: widthMm };
  const aspect = img ? img.naturalWidth / img.naturalHeight : 1;
  return { w: widthMm, h: Math.round((widthMm / aspect) * 10) / 10 };
}

export function shapePath(ctx, w, h, shape) {
  ctx.beginPath();
  if (shape === "circle") ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
  else if (shape === "rounded") ctx.roundRect(0, 0, w, h, Math.min(w, h) * 0.12);
  else ctx.rect(0, 0, w, h);
}

// Returns a canvas the size of the sticker in print dots. Inside the shape is
// paper and ink; outside it is transparent.
export function renderThermal(img, { w, h, shape, marginMm, mode, threshold, invert, paper }) {
  const W = Math.max(1, Math.round(w * DOTS_PER_MM));
  const H = Math.max(1, Math.round(h * DOTS_PER_MM));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  if (img) {
    // Fit the image inside the margin; a circle fits it by its diagonal.
    const m = marginMm * DOTS_PER_MM;
    const aspect = img.naturalWidth / img.naturalHeight;
    let bw, bh;
    if (shape === "circle") {
      const d = W - 2 * m;
      bh = d / Math.sqrt(aspect * aspect + 1);
      bw = bh * aspect;
    } else {
      bw = W - 2 * m;
      bh = H - 2 * m;
      if (bw / bh > aspect) bw = bh * aspect;
      else bh = bw / aspect;
    }
    ctx.drawImage(img, (W - bw) / 2, (H - bh) / 2, bw, bh);
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
