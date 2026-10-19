// Full-colour, custom-cut stickers: turns an uploaded image into the sticker
// that gets printed on the inkjet and cut on the Cricut (Print Then Cut).
//
// The print file is a PNG whose opaque area is exactly the sticker: the art
// on its white (or coloured) backing, see-through outside the cut line. Cricut
// Design Space traces that outline when the file is uploaded as a Print Then
// Cut image, so the file alone carries both the print and the cut.

export const PRINT_DPI = 300;
const MM_PER_IN = 25.4;
// Above this the print file won't fit through api/sticker-upload.js.
const MAX_PRINT_BYTES = 2.9 * 1024 * 1024;
// Uploads bigger than this are scaled down first; plenty for 300 dpi at the
// largest Print Then Cut size.
const MAX_SOURCE_PX = 2800;

export const BORDERS = [
  { key: "thin", name: "Thin", mm: 1.5 },
  { key: "medium", name: "Medium", mm: 3 },
  { key: "thick", name: "Thick", mm: 5 },
];
export const borderOf = (key) => BORDERS.find((b) => b.key === key) || BORDERS[1];

const ALPHA_MIN = 24; // a pixel at least this opaque counts as part of the art

function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

const nearWhite = (d, i) => d[i + 3] < ALPHA_MIN || (d[i] > 232 && d[i + 1] > 232 && d[i + 2] > 232);

// Clears every near-white pixel connected to the image's edge: the backdrop of
// a logo on white, without touching white inside the design.
function clearBackdrop(img) {
  const { width: w, height: h, data: d } = img;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const p = y * w + x;
    if (!seen[p] && nearWhite(d, p * 4)) {
      seen[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) push(x, 0), push(x, h - 1);
  for (let y = 0; y < h; y++) push(0, y), push(w - 1, y);
  while (stack.length) {
    const p = stack.pop();
    d[p * 4 + 3] = 0;
    const x = p % w, y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
}

// What an image looks like before any choices: is it already cut out
// (transparent background), and are its corners white (a logo on white)?
export function inspect(image) {
  const c = canvasOf(64, 64);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, 64, 64);
  const d = ctx.getImageData(0, 0, 64, 64).data;
  let clear = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < ALPHA_MIN) clear++;
  const corners = [0, 63, 64 * 63, 64 * 64 - 1].every((p) => nearWhite(d, p * 4));
  return { transparent: clear > 64, whiteCorners: corners };
}

// The art, trimmed to what's visible, optionally with a white backdrop
// removed. Returns a canvas, or null if nothing is left.
export function prepareArt(image, { removeWhite }) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const scale = Math.min(1, MAX_SOURCE_PX / Math.max(iw, ih));
  const src = canvasOf(iw * scale, ih * scale);
  const ctx = src.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, src.width, src.height);
  const data = ctx.getImageData(0, 0, src.width, src.height);
  if (removeWhite) {
    clearBackdrop(data);
    ctx.putImageData(data, 0, 0);
  }

  const { width: w, height: h, data: d } = data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] >= ALPHA_MIN) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const out = canvasOf(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext("2d").drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// Where the image sits in the sticker: `zoom` and a pan `x`, `y`.
//  - Die-cut: the outline follows the image, so zoom crops it (1 = whole
//    image) and x, y (0..1) are the centre of the part that's kept.
//  - Circle / square / rounded: zoom scales the image in the shape and x, y
//    (-1..1) move it, as a fraction of the sticker's size; the shape trims it.
export const PLACE_START = { contour: { zoom: 1, x: 0.5, y: 0.5 }, shape: { zoom: 1, x: 0, y: 0 } };
export const ZOOM = { contour: [1, 5], shape: [0.3, 4] };
export const placeKind = (shape) => (shape === "contour" ? "contour" : "shape");

// Keeps a placement inside what makes sense for the shape.
export function clampPlace(shape, { zoom, x, y }) {
  const kind = placeKind(shape);
  const [lo, hi] = ZOOM[kind];
  const z = Math.min(hi, Math.max(lo, zoom));
  if (kind === "shape") return { zoom: z, x: Math.min(1, Math.max(-1, x)), y: Math.min(1, Math.max(-1, y)) };
  const half = 0.5 / z;
  return { zoom: z, x: Math.min(1 - half, Math.max(half, x)), y: Math.min(1 - half, Math.max(half, y)) };
}

// The part of the art a die-cut sticker keeps (same shape as the art, so the
// sticker's size doesn't change as you zoom).
export function cropArt(art, place) {
  const { zoom, x, y } = clampPlace("contour", place);
  if (zoom === 1) return art;
  const w = art.width / zoom, h = art.height / zoom;
  const out = canvasOf(w, h);
  out.getContext("2d").drawImage(art, x * art.width - w / 2, y * art.height - h / 2, w, h, 0, 0, out.width, out.height);
  return out;
}

// The sticker's outside size (mm) for a given width, and where the art sits
// inside it. Pure maths, so sizes and prices update without drawing.
export function layout(art, { shape, border }, widthMm) {
  const a = art.width / art.height;
  const b = borderOf(border).mm;
  if (shape === "circle") {
    // The art's corners stay inside the circle, with the border to spare.
    const room = widthMm - 2 * b;
    const ah = room / Math.sqrt(a * a + 1);
    return { w: widthMm, h: widthMm, art: { w: ah * a, h: ah } };
  }
  if (shape === "square") {
    const room = widthMm - 2 * b;
    const aw = a >= 1 ? room : room * a;
    return { w: widthMm, h: widthMm, art: { w: aw, h: aw / a } };
  }
  // Die-cut and rounded hug the art, with the border all round.
  const aw = widthMm - 2 * b;
  return { w: widthMm, h: aw / a + 2 * b, art: { w: aw, h: aw / a } };
}

// The widest and narrowest the sticker can be: within `minMm` and the Print
// Then Cut area, either way round (`fits` from pricing.js).
export function widthRange(art, opts, fits, [lo, hi]) {
  const ok = (w) => {
    const l = layout(art, opts, w);
    return l.art.w > 0 && fits(l.w, l.h);
  };
  let min = null, max = null;
  for (let w = lo; w <= hi; w += 0.5) {
    if (ok(w)) {
      if (min === null) min = w;
      max = w;
    }
  }
  return min === null ? null : { min, max };
}

// Grows a silhouette outwards by `r` px by stamping it round a circle (a
// Minkowski sum, near enough), then fills any holes so the cut is one outline.
function backing(silhouette, r) {
  const { width: w, height: h } = silhouette;
  const out = canvasOf(w, h);
  const ctx = out.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(silhouette, 0, 0);
  for (const ring of [r, r * 0.66, r * 0.33]) {
    const n = Math.min(240, Math.max(12, Math.ceil((2 * Math.PI * ring) / 1.5)));
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 2 * Math.PI;
      ctx.drawImage(silhouette, ring * Math.cos(t), ring * Math.sin(t));
    }
  }

  // Blur and re-threshold (below): rounds off the bumps between letters and
  // fills notches too small for the blade to follow.
  const soft = canvasOf(w, h);
  const sctx = soft.getContext("2d", { willReadFrequently: true });
  sctx.filter = `blur(${Math.max(1, r * 0.45)}px)`;
  sctx.drawImage(out, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(soft, 0, 0);

  // Everything not reachable from the edge through clear pixels is inside.
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const outside = new Uint8Array(w * h);
  const stack = [];
  const push = (p) => {
    if (!outside[p] && d[p * 4 + 3] < 128) {
      outside[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) push(x), push((h - 1) * w + x);
  for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
  for (let p = 0; p < w * h; p++) d[p * 4 + 3] = outside[p] ? 0 : 255;
  ctx.putImageData(img, 0, 0);
  return out;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Draws the sticker at `pxPerMm`: backing in `bg`, art on top, see-through
// outside the cut line. Returns { canvas, w, h } (w, h in mm).
export function renderSticker(art, opts, widthMm, pxPerMm) {
  const { shape, border, bg } = opts;
  const l = layout(art, opts, widthMm);
  const px = (mm) => mm * pxPerMm;
  const out = canvasOf(px(l.w), px(l.h));
  const ctx = out.getContext("2d");
  // Die-cut: the crop is already in `art` (cropArt). Shapes: scale and move.
  const place = shape === "contour" ? PLACE_START.shape : clampPlace(shape, opts.place || PLACE_START.shape);
  const artW = px(l.art.w) * place.zoom, artH = px(l.art.h) * place.zoom;
  const ax = (out.width - artW) / 2 + place.x * out.width / 2;
  const ay = (out.height - artH) / 2 + place.y * out.height / 2;

  if (shape === "contour") {
    const sil = canvasOf(out.width, out.height);
    const sctx = sil.getContext("2d");
    sctx.drawImage(art, ax, ay, artW, artH);
    sctx.globalCompositeOperation = "source-in";
    sctx.fillStyle = "#000";
    sctx.fillRect(0, 0, sil.width, sil.height);
    const back = backing(sil, px(borderOf(border).mm));
    // Soften the stair-steps a touch, then paint the backing colour into it.
    ctx.filter = `blur(${Math.max(0.5, pxPerMm * 0.12)}px)`;
    ctx.drawImage(back, 0, 0);
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.globalCompositeOperation = "source-over";
  } else {
    ctx.fillStyle = bg;
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(out.width / 2, out.height / 2, out.width / 2, 0, 2 * Math.PI);
    } else {
      roundedRect(ctx, 0, 0, out.width, out.height, shape === "rounded" ? px(Math.min(5, l.w / 6, l.h / 6)) : px(1));
    }
    ctx.fill();
    ctx.save();
    ctx.clip();
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(art, ax, ay, artW, artH);
  if (shape !== "contour") ctx.restore();
  return { canvas: out, w: l.w, h: l.h };
}

// The print file: 300 dpi where it fits through the upload, a little less for
// the very largest stickers. Returns { dataUrl, dpi }.
export function printFile(art, opts, widthMm) {
  for (let dpi = PRINT_DPI; dpi >= 150; dpi -= 25) {
    const { canvas } = renderSticker(art, opts, widthMm, dpi / MM_PER_IN);
    const dataUrl = canvas.toDataURL("image/png");
    if (dataUrl.length * 0.75 <= MAX_PRINT_BYTES) return { dataUrl, dpi };
  }
  return { dataUrl: renderSticker(art, opts, widthMm, 150 / MM_PER_IN).canvas.toDataURL("image/png"), dpi: 150 };
}
