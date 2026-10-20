import { useEffect, useRef, useState } from "react";
import { Crop, ExternalLink, PenTool, RotateCcw, Square, Undo2, Wand2, X } from "lucide-react";
import { autoCrop } from "./colour.js";

// Crops an uploaded image before it becomes a sticker, two ways:
//  - Box: drag the corners or edges, drag inside to move the box, or drag
//    outside it to draw a new one.
//  - Shape: any outline. Tap to place corners (straight edges, so diagonals
//    and angles) or drag to draw freehand; then drag the corners about, drag
//    the dots between them to add one, double-click one to remove it. The
//    sticker keeps only what's inside, and a die-cut follows that outline.
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
const clamp01 = ([x, y]) => [clamp(x, 0, 1), clamp(y, 0, 1)];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function bounds(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function inside([x, y], pts) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// Fewer points for a freehand outline (Ramer-Douglas-Peucker), so it can be
// tweaked corner by corner afterwards. `eps` is in the same units as `pts`.
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const len = dist(a, b) || 1e-9;
  let far = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len;
    if (d > far) far = d, at = i;
  }
  if (far <= eps) return [a, b];
  return [...simplify(pts.slice(0, at + 1), eps).slice(0, -1), ...simplify(pts.slice(at), eps)];
}

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
  const [mode, setMode] = useState(initial?.path ? "shape" : "box");
  const [rect, setRect] = useState(initial && !initial.path ? initial : WHOLE);
  // Shape mode: the outline's corners (fractions of the image), whether it's
  // closed yet, and the freehand line being drawn.
  const [pts, setPts] = useState(initial?.path || []);
  const [closed, setClosed] = useState(!!initial?.path);
  const [trail, setTrail] = useState(null);
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

  // Shape mode. A tap places a corner (or closes the shape on the first one);
  // a drag draws freehand, or moves the closed shape when it starts inside.
  const capture = (e) => {
    e.stopPropagation();
    e.preventDefault();
    boxRef.current.setPointerCapture(e.pointerId);
  };
  const shapeDown = (e) => {
    capture(e);
    const at = clamp01(frac(e));
    if (closed) {
      if (inside(at, pts)) drag.current = { kind: "shape", at, from: pts };
      return;
    }
    drag.current = { kind: "stroke", at, moved: false };
    setTrail([at]);
  };
  const vertexDown = (i) => (e) => {
    capture(e);
    drag.current = { kind: "vertex", i, at: frac(e), moved: false };
  };
  // Dragging the dot halfway along an edge adds a corner there.
  const midDown = (i) => (e) => {
    capture(e);
    const a = pts[i], b = pts[(i + 1) % pts.length];
    setPts((ps) => [...ps.slice(0, i + 1), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ...ps.slice(i + 1)]);
    drag.current = { kind: "vertex", i: i + 1, at: frac(e), moved: true };
  };
  const shapeMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = frac(e);
    if (dist(p, d.at) > 0.012) d.moved = true;
    if (d.kind === "vertex") {
      if (d.moved) setPts((ps) => ps.map((q, j) => (j === d.i ? clamp01(p) : q)));
    } else if (d.kind === "shape") {
      // Move the whole outline, stopping at the image's edges.
      const b = bounds(d.from);
      const dx = clamp(p[0] - d.at[0], -b.x, 1 - b.x - b.w);
      const dy = clamp(p[1] - d.at[1], -b.y, 1 - b.y - b.h);
      setPts(d.from.map(([x, y]) => [x + dx, y + dy]));
    } else if (d.moved) {
      setTrail((t) => (dist(t[t.length - 1], p) > 0.004 ? [...t, clamp01(p)] : t));
    }
  };
  const shapeUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "vertex" && !d.moved && d.i === 0 && !closed && pts.length >= 3) setClosed(true);
    if (d.kind !== "stroke") return;
    setTrail(null);
    if (d.moved && trail && trail.length >= 6) {
      // A freehand outline: tidy it into editable corners and close it.
      const px = trail.map(([x, y]) => [x * iw, y * ih]);
      const s = simplify(px, 0.01 * Math.max(iw, ih)).map(([x, y]) => [x / iw, y / ih]);
      if (s.length > 3 && dist(s[0], s[s.length - 1]) < 0.02) s.pop();
      if (s.length >= 3) {
        setPts(s);
        setClosed(true);
      }
    } else if (!d.moved) {
      if (pts.length >= 3 && dist(d.at, pts[0]) < 0.03) setClosed(true);
      else setPts((ps) => [...ps, d.at]);
    }
  };
  const removeVertex = (i) => {
    if (closed && pts.length > 3) setPts((ps) => ps.filter((_, j) => j !== i));
  };
  const resetShape = () => {
    setPts([]);
    setClosed(false);
    setTrail(null);
  };

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
      setMode("box");
      setRect(r);
      setNote("");
    } else {
      setNote("No plain background to trim around, so this one needs cropping by hand.");
    }
  }

  const shape = mode === "shape";
  const shapeOk = pts.length >= 3;
  const whole = !shape && rect.w > 0.999 && rect.h > 0.999;
  const pct = (v) => `${v * 100}%`;
  const box = { left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) };
  const size = shape ? (shapeOk ? bounds(pts) : null) : rect;
  // SVG overlay coordinates: the image is 1000 × 1000 units (stretched to fit).
  const svgPts = (ps) => ps.map(([x, y]) => `${x * 1000},${y * 1000}`).join(" ");
  const poly = svgPts(pts);
  const apply = () => {
    if (!shape) return onApply(whole ? null : rect);
    if (shapeOk) onApply({ ...bounds(pts), path: pts });
  };

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
          Keep just the part you want on the sticker.{" "}
          {shape
            ? "Draw any outline: tap to place corners, or drag to draw freehand."
            : "Drag the corners, or drag outside the box to draw a new one."}
        </p>

        <div className="mt-3 inline-flex rounded-full bg-white p-1 ring-1 ring-ink/10" role="group" aria-label="Crop type">
          {[["box", Square, "Box"], ["shape", PenTool, "Shape"]].map(([key, Icon, name]) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => (setMode(key), setNote(""))}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${mode === key ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}
            >
              <Icon size={14} /> {name}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-center rounded-2xl bg-[#e9efe9] p-3 ring-1 ring-ink/10">
          <div
            ref={boxRef}
            onPointerDown={shape ? shapeDown : start("draw")}
            onPointerMove={shape ? shapeMove : move}
            onPointerUp={shape ? shapeUp : end}
            onPointerCancel={shape ? shapeUp : end}
            className={`relative touch-none select-none ${shape ? (closed ? "cursor-move" : "cursor-crosshair") : ""}`}
            style={{ aspectRatio: `${iw} / ${ih}`, width: `min(100%, calc(55vh * ${iw / ih}))` }}
          >
            {/* The image on a checkerboard (for see-through parts), dimmed outside the box. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[length:16px_16px] bg-[conic-gradient(#fff_25%,#dfe3df_0_50%,#fff_0_75%,#dfe3df_0)]">
              <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
              {!shape && (
                <div
                  className="absolute"
                  style={{ ...box, boxShadow: "0 0 0 9999px rgb(12 26 46 / 0.55)" }}
                />
              )}
              {shape && (
                <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                  {closed && <path d={`M0 0H1000V1000H0Z M${poly}Z`} fillRule="evenodd" fill="#0c1a2e" fillOpacity="0.55" />}
                  {pts.length > 0 && (
                    closed ? (
                      <polygon points={poly} fill="none" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    ) : (
                      <polyline points={poly} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                    )
                  )}
                  {trail && (
                    <polyline points={svgPts(trail)} fill="none" stroke="#ff5a1f" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                  )}
                </svg>
              )}
            </div>
            {/* Add-a-corner dots, left off busy freehand outlines where they'd crowd. */}
            {shape && closed && pts.length <= 24 && pts.map((a, i) => {
              const b = pts[(i + 1) % pts.length];
              return (
                <span
                  key={`m${i}`}
                  onPointerDown={midDown(i)}
                  title="Drag to add a corner"
                  className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-copy items-center justify-center"
                  style={{ left: pct((a[0] + b[0]) / 2), top: pct((a[1] + b[1]) / 2) }}
                >
                  <span className="h-2 w-2 rounded-full bg-white/70 ring-1 ring-ink/30" />
                </span>
              );
            })}
            {shape && pts.map((p, i) => (
              <span
                key={`v${i}`}
                onPointerDown={vertexDown(i)}
                onDoubleClick={() => removeVertex(i)}
                title={closed ? "Drag to move; double-click to remove" : i === 0 && pts.length >= 3 ? "Tap to close the shape" : undefined}
                className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center"
                style={{ left: pct(p[0]), top: pct(p[1]) }}
              >
                <span className={`h-3.5 w-3.5 rounded-full shadow ring-1 ring-ink/30 ${!closed && i === 0 && pts.length >= 3 ? "bg-flame" : "bg-white"}`} />
              </span>
            ))}
            {!shape && <div
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
            </div>}
          </div>
        </div>
        {shape && (
          <p className="mt-2 text-xs text-ink/55">
            {closed
              ? "Drag a corner to move it, drag a small dot to add a corner, double-click a corner to remove it. Drag inside to move the whole shape."
              : pts.length >= 3
                ? "Tap the first (orange) corner to close the shape, or press Crop."
                : "Tap to place corners. Straight lines join them, so you can cut diagonals and angles."}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={auto} className="btn-outline-dark h-9 px-3 text-sm">
            <Wand2 size={14} /> Auto-crop
          </button>
          {shape ? (
            <>
              {!closed && (
                <button type="button" onClick={() => setPts((ps) => ps.slice(0, -1))} disabled={!pts.length} className="btn-outline-dark h-9 px-3 text-sm disabled:opacity-40">
                  <Undo2 size={14} /> Undo corner
                </button>
              )}
              <button type="button" onClick={resetShape} disabled={!pts.length} className="btn-outline-dark h-9 px-3 text-sm disabled:opacity-40">
                <RotateCcw size={14} /> Start over
              </button>
            </>
          ) : (
            <button type="button" onClick={() => (setRect(WHOLE), setNote(""))} disabled={whole} className="btn-outline-dark h-9 px-3 text-sm disabled:opacity-40">
              <RotateCcw size={14} /> Whole image
            </button>
          )}
          {size && (
            <span className="ml-auto font-mono text-xs text-ink/50">
              {Math.round(size.w * iw)} × {Math.round(size.h * ih)} px
            </span>
          )}
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
          <button type="button" onClick={apply} disabled={shape && !shapeOk} className="btn-primary h-10 px-4 text-sm disabled:opacity-40">
            <Crop size={15} /> {whole ? "Use whole image" : "Crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
