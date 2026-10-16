import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, AlertCircle, Calculator } from "lucide-react";
import { clsx } from "clsx";
import { estimate as cfg } from "../../site.config.js";

const MESH_EXTENSIONS = [".stl", ".3mf"];
const INCH = 25.4;

export const fileKey = (f) => `${f.name}-${f.size}`;
const isMesh = (f) => MESH_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext));

// Measures every STL / 3MF in `files` once and works out the order estimate.
// Returns { parts, order, toggleInches } where `order` is null until something
// measurable is attached and each measured part carries its `geometries` for
// the preview. three.js and the maths load on the first model only.
export function useInstantEstimate(files, options) {
  const [lib, setLib] = useState(null);
  const [measures, setMeasures] = useState({}); // key -> { status, measure, geometries }
  const [inches, setInches] = useState({}); // key -> true when the user says so

  const meshes = files.filter(isMesh);

  useEffect(() => {
    const todo = meshes.filter((f) => !measures[fileKey(f)]);
    if (!todo.length) return;
    setMeasures((m) => ({ ...m, ...Object.fromEntries(todo.map((f) => [fileKey(f), { status: "loading" }])) }));

    (async () => {
      const mod = lib || (await import("../lib/meshEstimate.js"));
      setLib(mod);
      for (const f of todo) {
        let result;
        try {
          result = { status: "ok", ...(await mod.measureFile(f)) };
        } catch {
          result = { status: "error" };
        }
        setMeasures((m) => ({ ...m, [fileKey(f)]: result }));
      }
    })();
    // measures is read only to skip files already started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  return useMemo(() => {
    const parts = meshes.map((f) => {
      const key = fileKey(f);
      const entry = measures[key] || { status: "loading" };
      if (entry.status !== "ok" || !lib) return { file: f, key, status: entry.status };
      const measure = lib.scaleMeasure(entry.measure, inches[key] ? INCH : 1);
      return {
        file: f, key, status: "ok", measure, geometries: entry.geometries,
        checks: lib.checkMeasure(measure, cfg), inches: !!inches[key],
      };
    });
    const priced = parts.filter((p) => p.status === "ok" && !p.checks.unreliable);
    const order = lib && priced.length ? lib.estimateOrder(priced, options, cfg) : null;
    const toggleInches = (key) => setInches((s) => ({ ...s, [key]: !s[key] }));
    return { parts, order, toggleInches };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, measures, inches, lib, options.material, options.quality, options.quantity]);
}

const fmtSize = (size) => size.map((d) => (d < 10 ? d.toFixed(1) : Math.round(d))).join(" × ") + " mm";
const fmtMoney = (n) => `$${Math.round(n)}`;

// The spinning model. Mounts three.js once, then swaps in whichever part is
// selected. If WebGL isn't available the box simply has no preview.
function Preview({ part }) {
  const canvasRef = useRef(null);
  const stage = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (async () => {
      try {
        const { mountPreview } = await import("./PreviewScene.js");
        if (cancelled || !canvasRef.current) return;
        const s = mountPreview(canvasRef.current, { reducedMotion });
        if (cancelled) return s.dispose();
        stage.current = s;
        setReady(true);
      } catch (err) {
        console.warn("3D preview skipped:", err);
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      stage.current?.dispose();
      stage.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready && part) stage.current.show(part.geometries);
  }, [ready, part?.key, part?.geometries]);

  if (failed) return null;
  return (
    <div className="relative mb-3 h-48 overflow-hidden rounded-xl bg-white ring-1 ring-ink/5 sm:h-56">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        aria-label={part ? `3D preview of ${part.file.name}` : "3D preview"}
      />
      {(!ready || !part) && (
        <Loader2 size={20} className="absolute left-1/2 top-1/2 -ml-2.5 -mt-2.5 animate-spin text-ink/25" />
      )}
      {ready && part && (
        <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-ink/35">Drag to rotate</span>
      )}
    </div>
  );
}

function PartRow({ part, onToggleInches, selected, onSelect }) {
  if (part.status === "loading") {
    return (
      <li className="flex items-center gap-2 text-ink/55">
        <Loader2 size={13} className="animate-spin" /> Measuring {part.file.name}…
      </li>
    );
  }
  if (part.status === "error") {
    return (
      <li className="flex items-start gap-1.5 text-amber-700">
        <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
        Couldn't read {part.file.name}. I'll price it by hand.
      </li>
    );
  }

  const { measure, checks } = part;
  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={clsx(
              "truncate text-left font-medium underline-offset-4",
              selected ? "text-flame" : "hover:underline",
            )}
          >
            {part.file.name}
          </button>
        ) : (
          <span className="truncate font-medium">{part.file.name}</span>
        )}
        <span className="text-xs text-ink/50">{fmtSize(measure.size)}</span>
      </div>
      {(checks.tiny || part.inches) && (
        <label className="flex items-center gap-2 text-xs text-ink/60">
          <input type="checkbox" checked={part.inches} onChange={() => onToggleInches(part.key)} className="accent-flame" />
          {part.inches ? "Model is in inches" : "This looks tiny. Was it modelled in inches?"}
        </label>
      )}
      {checks.unreliable && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          The mesh has gaps, so it can't be measured reliably. I'll price this one by hand.
        </p>
      )}
      {checks.tooBig && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          Bigger than the {cfg.maxSizeMm} mm build plate. It may need splitting into pieces, which I'll quote separately.
        </p>
      )}
    </li>
  );
}

// Ballpark price under the file drop. Purely informational: the request still
// goes through the normal review and the customer gets a firm quote by email.
export function InstantEstimate({ estimate, material, quality }) {
  const { parts, order, toggleInches } = estimate;
  const [selectedKey, setSelectedKey] = useState(null);
  if (!parts.length) return null;

  // Preview the chosen part, or the first one that's been read.
  const viewable = parts.filter((p) => p.status === "ok");
  const shown = viewable.find((p) => p.key === selectedKey) || viewable[0];

  const materialName = cfg.materials[material] ? material : cfg.defaultMaterial;
  // "Extra fine 0.08mm" -> "extra fine", "Adaptive" -> "adaptive".
  const qualityName = quality ? quality.replace(/\s*[\d.]+mm$/, "").toLowerCase() : "standard";

  return (
    <div className="rounded-2xl border border-ink/10 bg-paper/60 p-4 text-sm" aria-live="polite">
      <p className="flex items-center gap-2 font-medium text-ink/75">
        <Calculator size={15} className="text-flame" /> Instant estimate
      </p>

      <div className="mt-3">
        {viewable.length > 0 && <Preview part={shown} />}
        <ul className="space-y-2.5">
          {parts.map((p) => (
            <PartRow
              key={p.key}
              part={p}
              onToggleInches={toggleInches}
              selected={p === shown}
              // Only worth a button when there's more than one to pick from.
              onSelect={viewable.length > 1 && p.status === "ok" ? () => setSelectedKey(p.key) : null}
            />
          ))}
        </ul>
      </div>

      {order && (
        <div className="mt-4 border-t border-ink/10 pt-3">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-display text-2xl font-semibold">
              {order.low === order.high ? fmtMoney(order.low) : `${fmtMoney(order.low)}–${fmtMoney(order.high)}`}
            </span>
            <span className="text-xs text-ink/50">
              ~{Math.round(order.grams)} g · ~{order.hours < 1 ? `${Math.max(1, Math.round(order.hours * 60))} min` : `${order.hours.toFixed(1)} h`} printing
            </span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink/55">
            {materialName}, {qualityName === "adaptive" ? "adaptive layer height" : `${qualityName} quality`}, {order.quantity} {order.quantity === 1 ? "copy" : "copies"}
            {order.discount > 0 && ` (${Math.round(order.discount * 100)}% bulk discount)`}. CAD before tax and shipping.
          </p>
          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-flame-100/60 px-3 py-2 text-xs leading-relaxed text-ink/75">
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0 text-flame" />
            <span>
              <strong className="font-semibold">This is an estimate, not a quote.</strong> Send this request for your
              official quote: I'll check the model and confirm a fixed price within one business day.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
