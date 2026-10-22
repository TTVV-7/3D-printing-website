import { useEffect, useRef, useState } from "react";
import { FileUp, Pencil, RotateCcw, Undo2, X } from "lucide-react";
import { clsx } from "clsx";
import { ROUTE_WIDTHS, drawRoute, normalise, readGpx } from "./route.js";

// Draw a trail on a pad, or load a GPX file, for a route layer (route.js).
// `route` is the layer being changed, if any; onDone gets { points, aspect,
// width, dash, ends }.
export function RouteDialog({ route, onDone, onClose }) {
  const [tab, setTab] = useState("draw");
  const [strokes, setStrokes] = useState([]);
  const [gpx, setGpx] = useState(null); // { name, route }
  const [error, setError] = useState("");
  const [style, setStyle] = useState({ width: route?.width ?? 1.2, dash: route?.dash ?? false, ends: route?.ends ?? true });
  const pad = useRef(null);
  const drawing = useRef(null);
  const fileRef = useRef(null);

  // The line as it stands: GPX on its tab, else what's drawn, else the
  // route being changed.
  const drawn = strokes.flat().length > 1 ? normalise(strokes.flat(), { round: true }) : null;
  const current = tab === "gpx" ? gpx?.route : drawn || (strokes.length ? null : route);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Redraws the pad: a faint grid, then the line (while drawing, the raw
  // strokes; otherwise the cleaned-up route).
  useEffect(() => {
    const c = pad.current;
    if (!c) return;
    const S = c.width, g = c.getContext("2d");
    g.fillStyle = "#f7f5f0";
    g.fillRect(0, 0, S, S);
    g.strokeStyle = "rgba(12,26,46,0.07)";
    g.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      g.beginPath(); g.moveTo((i * S) / 10, 0); g.lineTo((i * S) / 10, S); g.stroke();
      g.beginPath(); g.moveTo(0, (i * S) / 10); g.lineTo(S, (i * S) / 10); g.stroke();
    }
    if (tab === "draw" && drawing.current) {
      g.strokeStyle = "#0c1a2e";
      g.lineWidth = S / 90;
      g.lineCap = g.lineJoin = "round";
      for (const st of strokes) {
        g.beginPath();
        st.forEach(([x, y], i) => (i ? g.lineTo(x * S, y * S) : g.moveTo(x * S, y * S)));
        g.stroke();
      }
      return;
    }
    if (current) {
      g.save();
      g.translate(S / 2, S / 2);
      drawRoute(g, { ...current, ...style }, S * 0.8, S / 60, false);
      g.restore();
    } else {
      g.fillStyle = "rgba(12,26,46,0.4)";
      g.font = `${S / 22}px ui-sans-serif, system-ui, sans-serif`;
      g.textAlign = "center";
      g.fillText(tab === "draw" ? "Draw your trail here" : "Your route shows here", S / 2, S / 2);
    }
  });

  const at = (e) => {
    const r = pad.current.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const down = (e) => {
    if (tab !== "draw") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    setStrokes((s) => [...s, [at(e)]]);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const p = at(e);
    setStrokes((s) => {
      const last = s[s.length - 1], [lx, ly] = last[last.length - 1];
      if (Math.hypot(p[0] - lx, p[1] - ly) < 0.004) return s;
      return [...s.slice(0, -1), [...last, p]];
    });
  };
  const up = () => {
    drawing.current = null;
    setStrokes((s) => [...s]);
  };

  async function loadGpx(file) {
    setError("");
    if (!file) return;
    try {
      const r = readGpx(await file.text());
      if (!r) throw new Error();
      setGpx({ name: file.name, route: r });
    } catch {
      setError("That file has no track in it. Export the activity or route as GPX and try again.");
    }
  }

  const chip = (on) => clsx("rounded-full px-3 py-1.5 text-sm ring-1 transition", on ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40");

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a route"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 hover:bg-ink/5">
          <X size={18} />
        </button>
        <p className="text-lg font-semibold">Your route</p>
        <p className="mt-0.5 text-sm text-ink/60">Draw the trail, or load the GPX of a ride or hike.</p>

        <div className="mt-4 flex gap-2" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "draw"} onClick={() => setTab("draw")} className={chip(tab === "draw")}>
            <Pencil size={14} className="mr-1 inline" /> Draw it
          </button>
          <button type="button" role="tab" aria-selected={tab === "gpx"} onClick={() => setTab("gpx")} className={chip(tab === "gpx")}>
            <FileUp size={14} className="mr-1 inline" /> From a GPX file
          </button>
        </div>

        <canvas
          ref={pad}
          width={720}
          height={720}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className={clsx("mt-3 aspect-square w-full touch-none rounded-2xl ring-1 ring-ink/10", tab === "draw" && "cursor-crosshair")}
          aria-label={tab === "draw" ? "Drawing pad: drag to draw your route" : "Your route"}
        />

        {tab === "draw" ? (
          <div className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span className="text-ink/55">Drag to draw. Lift and keep going to add to the line.</span>
            <span className="flex flex-none gap-1">
              <button type="button" onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length} className="rounded-lg p-2 hover:bg-ink/5 disabled:opacity-30" aria-label="Undo">
                <Undo2 size={16} />
              </button>
              <button type="button" onClick={() => setStrokes([])} disabled={!strokes.length} className="rounded-lg p-2 hover:bg-ink/5 disabled:opacity-30" aria-label="Start again">
                <RotateCcw size={16} />
              </button>
            </span>
          </div>
        ) : (
          <div className="mt-2 text-sm">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-outline-dark h-10 w-full text-sm">
              <FileUp size={15} /> {gpx ? `Change file (${gpx.name})` : "Choose a .gpx file"}
            </button>
            <input ref={fileRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" className="hidden" onChange={(e) => loadGpx(e.target.files[0])} />
            <p className="mt-2 text-xs text-ink/50">
              Strava: open the activity, ··· then Export GPX. Garmin, Trailforks, AllTrails and Komoot have an export too. North is up.
            </p>
            {error && <p className="mt-2 rounded-xl bg-flame-100 px-3 py-2 text-flame-600">{error}</p>}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 w-14 text-xs font-semibold uppercase tracking-wider text-ink/50">Line</span>
            {ROUTE_WIDTHS.map(([name, w]) => (
              <button key={name} type="button" onClick={() => setStyle((s) => ({ ...s, width: w }))} className={chip(style.width === w)}>
                {name}
              </button>
            ))}
            <button type="button" onClick={() => setStyle((s) => ({ ...s, dash: !s.dash }))} className={chip(style.dash)}>
              Dashed
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 w-14 text-xs font-semibold uppercase tracking-wider text-ink/50">Ends</span>
            <button type="button" onClick={() => setStyle((s) => ({ ...s, ends: !s.ends }))} className={chip(style.ends)}>
              Start dot and finish ring
            </button>
          </div>
        </div>

        <button type="button" disabled={!current} onClick={() => onDone({ ...current, ...style })} className="btn-primary mt-5 w-full disabled:opacity-40">
          {route ? "Update the route" : "Put it on the sticker"}
        </button>
      </div>
    </div>
  );
}
