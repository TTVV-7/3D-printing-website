import { useEffect, useRef, useState } from "react";
import { Crop, ExternalLink, RotateCcw, Wand2, X } from "lucide-react";
import { autoCrop } from "./colour.js";

// Crops an uploaded image before it becomes a sticker: drag the corners or
// edges, drag inside to move the box, or drag outside it to draw a new one.
// "Auto-crop" suggests a box around the design when it sits on a plain or
// see-through background (colour.js). Photos need their background removed
// properly first, which is better done by a dedicated tool (REMOVERS).

const WHOLE = { x: 0, y: 0, w: 1, h: 1 };
const MIN = 0.04; // the smallest box, as a fraction of the image
const REMOVERS = [
  ["remove.bg", "https://www.remove.bg/upload"],
  ["Adobe Express", "https://www.adobe.com/express/feature/image/remove-background"],
];
const HANDLES = [
  ["nw", "left-0 top-0 cursor-nwse-resize"],
  ["n", "left-1/2 top-0 cursor-ns-resize"],
  ["ne", "left-full top-0 cursor-nesw-resize"],
  ["e", "left-full top-1/2 cursor-ew-resize"],
  ["se", "left-full top-full cursor-nwse-resize"],
  ["s", "left-1/2 top-full cursor-ns-resize"],
  ["sw", "left-0 top-full cursor-nesw-resize"],
  ["w", "left-0 top-1/2 cursor-ew-resize"],
];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The box after dragging `mode` by (dx, dy), all in fractions of the image.
function dragged(r, mode, dx, dy, at) {
  if (mode === "move") return { ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) };
  if (mode === "draw") {
    const [ax, ay] = at;
    const bx = clamp(ax + dx, 0, 1), by = clamp(ay + dy, 0, 1);
    const w = Math.max(MIN, Math.abs(bx - ax)), h = Math.max(MIN, Math.abs(by - ay));
    return { x: clamp(Math.min(ax, bx), 0, 1 - w), y: clamp(Math.min(ay, by), 0, 1 - h), w, h };
  }
  let l = r.x, t = r.y, rt = r.x + r.w, b = r.y + r.h;
  if (mode.includes("w")) l = clamp(l + dx, 0, rt - MIN);
  if (mode.includes("e")) rt = clamp(rt + dx, l + MIN, 1);
  if (mode.includes("n")) t = clamp(t + dy, 0, b - MIN);
  if (mode.includes("s")) b = clamp(b + dy, t + MIN, 1);
  return { x: l, y: t, w: rt - l, h: b - t };
}

export function CropDialog({ image, initial, fresh, onApply, onClose }) {
  const [rect, setRect] = useState(initial || WHOLE);
  const [note, setNote] = useState("");
  const boxRef = useRef(null);
  const drag = useRef(null);
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const src = image.src || image.toDataURL?.();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const frac = (e) => {
    const b = boxRef.current.getBoundingClientRect();
    return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height];
  };
  const start = (mode) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    boxRef.current.setPointerCapture(e.pointerId);
    const at = frac(e);
    drag.current = { mode, at, from: rect };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const [x, y] = frac(e);
    setRect(dragged(d.from, d.mode, x - d.at[0], y - d.at[1], d.at));
  };
  const end = () => (drag.current = null);

  // Arrow keys nudge the box; with Shift they resize it.
  const onKeyDown = (e) => {
    const step = 0.01;
    const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!k) return;
    e.preventDefault();
    setRect((r) => dragged(r, e.shiftKey ? "se" : "move", k[0], k[1]));
  };

  function auto() {
    const r = autoCrop(image);
    if (r) {
      setRect(r);
      setNote("");
    } else {
      setNote("No plain background to trim around, so this one needs cropping by hand.");
    }
  }

  const whole = rect.w > 0.999 && rect.h > 0.999;
  const pct = (v) => `${v * 100}%`;
  const box = { left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Crop your image"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 hover:bg-ink/5" aria-label="Close">
          <X size={18} />
        </button>
        <p className="font-mono text-[10px] uppercase tracking-widest text-flame">Crop your image</p>
        <p className="mt-1 pr-8 text-sm text-ink/60">
          Keep just the part you want on the sticker. Drag the corners, or drag outside the box to draw a new one.
        </p>

        <div className="mt-4 flex justify-center rounded-2xl bg-[#e9efe9] p-3 ring-1 ring-ink/10">
          <div
            ref={boxRef}
            onPointerDown={start("draw")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className="relative touch-none select-none"
            style={{ aspectRatio: `${iw} / ${ih}`, width: `min(100%, calc(55vh * ${iw / ih}))` }}
          >
            {/* The image on a checkerboard (for see-through parts), dimmed outside the box. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[length:16px_16px] bg-[conic-gradient(#fff_25%,#dfe3df_0_50%,#fff_0_75%,#dfe3df_0)]">
              <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
              <div
                className="absolute"
                style={{ ...box, boxShadow: "0 0 0 9999px rgb(12 26 46 / 0.55)" }}
              />
            </div>
            <div
              role="slider"
              tabIndex={0}
              aria-label="Crop box. Arrow keys move it; Shift and arrow keys resize it."
              aria-valuetext={`${Math.round(rect.w * iw)} by ${Math.round(rect.h * ih)} pixels`}
              onKeyDown={onKeyDown}
              onPointerDown={start("move")}
              className="absolute cursor-move outline-none ring-2 ring-white focus-visible:ring-flame"
              style={box}
            >
              {/* Rule-of-thirds guides. */}
              <span className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/40" />
              <span className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/40" />
              <span className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/40" />
              <span className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/40" />
              {HANDLES.map(([mode, pos]) => (
                <span
                  key={mode}
                  onPointerDown={start(mode)}
                  className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center ${pos}`}
                >
                  <span className="h-3 w-3 rounded-sm bg-white shadow ring-1 ring-ink/30" />
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={auto} className="btn-outline-dark h-9 px-3 text-sm">
            <Wand2 size={14} /> Auto-crop
          </button>
          <button type="button" onClick={() => (setRect(WHOLE), setNote(""))} disabled={whole} className="btn-outline-dark h-9 px-3 text-sm disabled:opacity-40">
            <RotateCcw size={14} /> Whole image
          </button>
          <span className="ml-auto font-mono text-xs text-ink/50">
            {Math.round(rect.w * iw)} × {Math.round(rect.h * ih)} px
          </span>
        </div>
        {note && <p className="mt-2 text-sm text-flame-600">{note}</p>}
        <p className="mt-3 text-xs text-ink/55">
          Is it a photo? For the cut to follow just the subject, remove its background first with a free tool like{" "}
          {REMOVERS.map(([name, url], i) => (
            <span key={name}>
              {i > 0 && " or "}
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-ink underline underline-offset-2">
                {name}
                <ExternalLink size={11} />
              </a>
            </span>
          ))}
          , then upload the PNG it gives you.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-outline-dark h-10 px-4 text-sm">
            {fresh ? "Skip" : "Cancel"}
          </button>
          <button type="button" onClick={() => onApply(whole ? null : rect)} className="btn-primary h-10 px-4 text-sm">
            <Crop size={15} /> {whole ? "Use whole image" : "Crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
