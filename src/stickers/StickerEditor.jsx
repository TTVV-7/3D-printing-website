import { useEffect, useRef, useState } from "react";
import { layerSize } from "./thermal.js";

// The flat editing view: the sticker as it will print, big, with the design's
// layers to drag, scale and turn. Drag a layer to move it; drag a corner
// handle to scale and turn it together; scroll over the selected layer to
// scale it. Everything here is in sticker millimetres (the SVG's viewBox).

const SNAP = (4 * Math.PI) / 180; // rotation snaps to square within 4°
const MIN_SCALE = 0.05;
const MAX_SCALE = 8;

function snapAngle(a) {
  const q = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
  return Math.abs(a - q) < SNAP ? q : a;
}

export function StickerEditor({ art, sticker, layers, selected, onSelect, onChange }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const artRef = useRef(null);
  const drag = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const { w, h } = sticker;

  // Fit the sticker in the stage with room around it.
  useEffect(() => {
    const el = wrapRef.current;
    const fit = () => {
      const k = Math.min((el.clientWidth * 0.82) / w, (el.clientHeight * 0.78) / h);
      setBox({ width: w * k, height: h * k });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);

  useEffect(() => {
    const c = artRef.current;
    if (!c || !art) return;
    c.width = art.width;
    c.height = art.height;
    c.getContext("2d").drawImage(art, 0, 0);
  }, [art]);

  const mmPerPx = box.width ? w / box.width : 1;
  const handleR = 7 * mmPerPx;

  const geom = (l) => {
    const { lw, lh } = layerSize(l, sticker);
    return { cx: w / 2 + l.x * w, cy: h / 2 + l.y * w, lw, lh };
  };
  const corners = (l) => {
    const { cx, cy, lw, lh } = geom(l);
    const c = Math.cos(l.rot), s = Math.sin(l.rot);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
      const x = (sx * lw) / 2, y = (sy * lh) / 2;
      return [cx + x * c - y * s, cy + x * s + y * c];
    });
  };
  const toMm = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * w, ((e.clientY - r.top) / r.height) * h];
  };
  const hits = (l, [px, py]) => {
    const { cx, cy, lw, lh } = geom(l);
    const dx = px - cx, dy = py - cy;
    const c = Math.cos(-l.rot), s = Math.sin(-l.rot);
    const pad = 2 * mmPerPx;
    return Math.abs(dx * c - dy * s) <= lw / 2 + pad && Math.abs(dx * s + dy * c) <= lh / 2 + pad;
  };
  const update = (id, patch) => onChange(layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  function down(e) {
    const p = toMm(e);
    const sel = layers.find((l) => l.id === selected);
    // A corner handle of the selected layer: scale and turn.
    if (sel && corners(sel).some(([x, y]) => Math.hypot(p[0] - x, p[1] - y) < handleR * 1.8)) {
      const { cx, cy } = geom(sel);
      drag.current = { mode: "transform", id: sel.id, cx, cy, d0: Math.hypot(p[0] - cx, p[1] - cy), a0: Math.atan2(p[1] - cy, p[0] - cx), scale: sel.scale, rot: sel.rot };
    } else {
      const hit = [...layers].reverse().find((l) => hits(l, p));
      onSelect(hit?.id ?? null);
      if (!hit) return;
      drag.current = { mode: "move", id: hit.id, p0: p, x: hit.x, y: hit.y };
    }
    svgRef.current.setPointerCapture(e.pointerId);
  }

  function move(e) {
    const d = drag.current;
    if (!d) return;
    const p = toMm(e);
    if (d.mode === "move") {
      update(d.id, { x: d.x + (p[0] - d.p0[0]) / w, y: d.y + (p[1] - d.p0[1]) / w });
    } else {
      const dist = Math.hypot(p[0] - d.cx, p[1] - d.cy);
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (d.scale * dist) / (d.d0 || 1)));
      const rot = snapAngle(d.rot + Math.atan2(p[1] - d.cy, p[0] - d.cx) - d.a0);
      update(d.id, { scale, rot });
    }
  }

  const up = () => (drag.current = null);

  // Scroll to scale the selected layer.
  useEffect(() => {
    const el = svgRef.current;
    const onWheel = (e) => {
      const sel = layers.find((l) => l.id === selected);
      if (!sel) return;
      e.preventDefault();
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, sel.scale * Math.exp(-e.deltaY / 500)));
      onChange(layers.map((l) => (l.id === sel.id ? { ...l, scale } : l)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [layers, selected, onChange]);

  const sel = layers.find((l) => l.id === selected);

  return (
    <div ref={wrapRef} className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_#1d3a5c_0%,_#0c1a2e_75%)]">
      <div className="relative" style={box}>
        <canvas
          ref={artRef}
          className="absolute inset-0 h-full w-full drop-shadow-[0_10px_25px_rgba(0,0,0,0.45)]"
        />
        <svg
          ref={svgRef}
          data-sticker-editor
          viewBox={`0 0 ${w} ${h}`}
          className="absolute inset-0 h-full w-full touch-none select-none"
          style={{ cursor: drag.current?.mode === "move" ? "grabbing" : "default", overflow: "visible" }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          {layers.map((l) => {
            const { cx, cy, lw, lh } = geom(l);
            return (
              <rect
                key={l.id}
                x={cx - lw / 2}
                y={cy - lh / 2}
                width={lw}
                height={lh}
                transform={`rotate(${(l.rot * 180) / Math.PI} ${cx} ${cy})`}
                fill="transparent"
                stroke={l.id === selected ? "#ff5b1f" : "rgba(255,91,31,0)"}
                strokeWidth={1.5 * mmPerPx}
                strokeDasharray={`${4 * mmPerPx} ${3 * mmPerPx}`}
                style={{ cursor: "move" }}
              />
            );
          })}
          {sel &&
            corners(sel).map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={handleR}
                fill="#fff"
                stroke="#ff5b1f"
                strokeWidth={2 * mmPerPx}
                style={{ cursor: "nwse-resize" }}
              />
            ))}
        </svg>
      </div>
    </div>
  );
}
