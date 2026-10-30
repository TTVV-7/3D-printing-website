import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import { clsx } from "clsx";
import { searchPlaces } from "./places.js";

// An address box that suggests places as you type (places.js). `stop` is
// { text, place }: place is null until one is picked from the list.
export function PlaceInput({ stop, onChange, placeholder, onRemove }) {
  const [found, setFound] = useState({ q: "", results: [] });
  const results = found.results;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const typed = useRef(false);
  const focusing = useRef(false);

  useEffect(() => {
    const q = stop.text.trim();
    if (!typed.current || q.length < 3) return setFound({ q, results: [] });
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setBusy(true);
      searchPlaces(q, ctl.signal)
        .then((r) => {
          setFound({ q, results: r });
          setActive(0);
        })
        .catch(() => {})
        .finally(() => setBusy(false));
    }, 300);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [stop.text]);

  const choose = (place) => {
    typed.current = false;
    onChange({ text: place.label, place });
    setOpen(false);
  };

  return (
    <div className="relative">
      <MapPin size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
      <input
        value={stop.text}
        placeholder={placeholder}
        onChange={(e) => {
          typed.current = true;
          onChange({ text: e.target.value, place: null });
          setOpen(true);
        }}
        onFocus={(e) => {
          // Typing replaces the place. The mouse-up of the click that
          // focused the box would clear the selection, so that one is skipped.
          e.target.select();
          focusing.current = true;
          setOpen(true);
        }}
        onMouseUp={(e) => {
          if (focusing.current) e.preventDefault();
          focusing.current = false;
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(results.length - 1, a + 1)));
          if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(0, a - 1)));
          // Only once the list is for what's in the box, not a few letters ago.
          if (e.key === "Enter") (e.preventDefault(), found.q === stop.text.trim() && choose(results[active]));
        }}
        className={clsx("field pl-9", onRemove && "pr-10", !stop.place && stop.text && "ring-flame/50")}
        aria-label={placeholder}
        autoComplete="off"
      />
      {busy && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink/40" />}
      {onRemove && !busy && (
        <button type="button" onClick={onRemove} aria-label="Remove this stop" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink/45 hover:bg-flame hover:text-white">
          <X size={14} />
        </button>
      )}
      {open && results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl bg-white text-sm shadow-lg ring-1 ring-ink/10">
          {results.map((r, i) => (
            <li key={`${r.lon},${r.lat},${i}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                className={clsx("block w-full px-3 py-2 text-left", i === active ? "bg-paper" : "hover:bg-paper")}
              >
                <span className="block font-medium">{r.label}</span>
                {r.sub && <span className="block truncate text-xs text-ink/55">{r.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The 3D view, in a canvas of its own made here: React's development mode
// mounts twice, and two renderers sharing one canvas's WebGL context garble
// each other's textures.
