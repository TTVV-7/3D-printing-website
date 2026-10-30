// Background removal for photos: finds the main subject (a pet, a person, a
// thing) and makes everything else see-through. Runs in the browser with
// U²-Net-p (Apache 2.0, public/models/u2netp.onnx, 4.6 MB) on ONNX Runtime,
// so photos never leave the customer's device and there's nothing to pay
// for. The runtime and model only download the first time it's used.
//
// For plain backgrounds (a logo on white) colour.js's backdrop removal is
// quicker and exact; this is for photos it can't do.
// The runtime's WebAssembly and its loader, served from this site.
import wasmUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url";
import mjsUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url";

const MODEL_URL = "/models/u2netp.onnx";
const SIZE = 320; // the model's input, square
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
// The mask is soft; values below LOW go fully clear and above HIGH fully
// solid, which drops faint ghosts of the background and firms up edges.
const LOW = 0.15;
const HIGH = 0.6;

let session = null;
async function model() {
  if (!session) {
    session = (async () => {
      const ort = await import("onnxruntime-web/wasm");
      ort.env.wasm.wasmPaths = { mjs: mjsUrl, wasm: wasmUrl };
      // One thread: more would need cross-origin isolation headers.
      ort.env.wasm.numThreads = 1;
      return ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] }).then((s) => ({ ort, s }));
    })().catch((err) => {
      session = null; // let a later click try again
      throw err;
    });
  }
  return session;
}

// Starts the download early (say, when the option comes into view), so the
// first cut-out is quicker. Errors wait for the real call.
export function warmUp() {
  model().catch(() => {});
}

function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// `image` (an image or canvas) with its background made see-through, as a
// canvas the same size. Throws if the model can't load.
export async function removeBackground(image) {
  const { ort, s } = await model();
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;

  // Fit the longest side to the model's square, padding the rest with black.
  const k = SIZE / Math.max(iw, ih);
  const fw = Math.max(1, Math.round(iw * k)), fh = Math.max(1, Math.round(ih * k));
  const small = canvasOf(SIZE, SIZE);
  const sctx = small.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(image, 0, 0, fw, fh);
  const px = sctx.getImageData(0, 0, SIZE, SIZE).data;
  const input = new Float32Array(3 * SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const p = y * SIZE + x;
      const inside = x < fw && y < fh;
      for (let c = 0; c < 3; c++) {
        input[c * SIZE * SIZE + p] = inside ? (px[p * 4 + c] / 255 - MEAN[c]) / STD[c] : 0;
      }
    }
  }
  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) });
  const pred = out[s.outputNames[0]].data;

  // Stretch the fitted part of the mask to 0..1, then firm it up.
  let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const v = pred[y * SIZE + x];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const mask = canvasOf(fw, fh);
  const mctx = mask.getContext("2d");
  const m = mctx.createImageData(fw, fh);
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const v = (pred[y * SIZE + x] - lo) / (hi - lo || 1);
      const a = Math.min(1, Math.max(0, (v - LOW) / (HIGH - LOW)));
      const i = (y * fw + x) * 4;
      m.data[i] = m.data[i + 1] = m.data[i + 2] = 255;
      m.data[i + 3] = Math.round(a * 255);
    }
  }
  mctx.putImageData(m, 0, 0);

  // The photo at full size, kept only where the (smoothly scaled-up) mask is.
  const result = canvasOf(iw, ih);
  const ctx = result.getContext("2d");
  ctx.drawImage(image, 0, 0, iw, ih);
  ctx.globalCompositeOperation = "destination-in";
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mask, 0, 0, iw, ih);
  return result;
}
