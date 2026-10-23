import { useEffect, useMemo, useRef, useState } from "react";
import { Bike, ExternalLink, Loader2, Maximize2, Plus, ScanSearch } from "lucide-react";
import { clsx } from "clsx";
import { stickers } from "../../site.config.js";
import { BIKE_MODELS, PAINTS, TUBES, bikeOf } from "./bikeModels.js";
import { BIKE_FONTS, FLAGS, loadFlag, nameSticker, routeSticker } from "./bikeArt.js";
import { bikeRoute, googleMapsLink } from "./places.js";
import { PlaceInput } from "./PlaceInput.jsx";

// Bike stickers: a name with a flag for the top tube, or a ride's route for
// the down tube, shown wrapped round a real-size bike (BikeModelScene.js).
// Printed in full colour like the custom-cut stickers. "Coming soon" until
// stickers.bikeColour.available.

const PREVIEW_PX = 12; // texture pixels per mm in the 3D view
const NAME_HEIGHTS = [12, 15, 20, 25];
const ROUTE_SIZES = [
  { key: "s", name: "Small", w: 80, h: 28 },
  { key: "m", name: "Medium", w: 100, h: 35 },
  { key: "l", name: "Large", w: 130, h: 45 },
];
// Label colour and the ink that reads on it.
const LABELS = [
  ["#f5f4f0", "#15161a", "White"],
  ["#15161a", "#f5f4f0", "Black"],
  ["#0c1a2e", "#f5f4f0", "Navy"],
  ["#f2c230", "#15161a", "Yellow"],
  ["#c8102e", "#ffffff", "Red"],
];
const LINES = ["#ff5b1f", "#c8102e", "#1f6fd1", "#2fae4f", "#15161a"];
// Kitsilano Beach to Stanley Park, until someone types their own.
const START_STOPS = [
  { text: "Kitsilano Beach", place: { label: "Kitsilano Beach", short: "Kits Beach", lon: -123.1546, lat: 49.2739 } },
  { text: "Stanley Park", place: { label: "Stanley Park", short: "Stanley Park", lon: -123.1443, lat: 49.3043 } },
];
const inches = (mm) => (mm / 25.4).toFixed(1);

function Choice({ active, onClick, children, sub }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-xl p-3 text-left ring-1 transition",
        active ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40",
      )}
    >
      <span className="block text-sm font-semibold">{children}</span>
      {sub && <span className={clsx("mt-0.5 block text-xs", active ? "text-white/60" : "text-ink/55")}>{sub}</span>}
    </button>
  );
}

function Label({ children, hint }) {
  return (
    <p className="mb-2 flex items-baseline justify-between text-sm font-semibold">
      {children}
      {hint && <span className="font-normal text-ink/50">{hint}</span>}
    </p>
  );
}

function Swatches({ items, value, onChange, label }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map(([hex, name]) => (
        <button
          key={hex}
          type="button"
          onClick={() => onChange(hex)}
          aria-pressed={value === hex}
          title={name}
          className={clsx(
            "h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-paper transition",
            value === hex ? "ring-flame" : "ring-transparent hover:ring-ink/20",
          )}
          style={{ background: hex, boxShadow: "inset 0 0 0 1px rgb(12 26 46 / 0.15)" }}
        >
          <span className="sr-only">{name}</span>
        </button>
      ))}
      <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full ring-1 ring-ink/15" title="Any colour">
        <span className="absolute inset-0 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0" aria-label={label} />
      </label>
    </div>
  );
}

function useBikeStage(boxRef, label) {
  const stage = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.className = "absolute inset-0 h-full w-full cursor-grab touch-pan-y active:cursor-grabbing";
    boxRef.current.prepend(canvas);
    import("./BikeModelScene.js")
      .then(({ mountBike }) => mountBike(canvas, { reducedMotion }))
      .then((s) => {
        if (cancelled) return s.dispose();
        stage.current = s;
        s.start();
        setReady(true);
      })
      .catch((err) => console.warn("3D preview skipped:", err));
    return () => {
      cancelled = true;
      stage.current?.dispose();
      stage.current = null;
      canvas.remove();
    };
  }, [boxRef]);
  // Says what's on screen, for screen readers.
  useEffect(() => boxRef.current.querySelector("canvas")?.setAttribute("aria-label", label));
  return { stage, ready };
}

export function BikeStudio() {
  const available = stickers.bikeColour.available;
  const boxRef = useRef(null);
  const flatRef = useRef(null);

  const [design, setDesign] = useState("name");
  const [bikeKey, setBikeKey] = useState("road");
  const [paint, setPaint] = useState(PAINTS[0][0]);
  const [tubeChoice, setTube] = useState(null); // null: the design's usual tube
  const [at, setAt] = useState(0.5);
  const [turn, setTurn] = useState(0);
  const [view, setView] = useState("sticker");
  const [finishKey, setFinishKey] = useState(stickers.colour.finishes[0].key);
  const [labelKey, setLabelKey] = useState(0);
  const [bg, ink] = LABELS[labelKey];
  const [font, setFont] = useState(BIKE_FONTS[0].family);
  const [fontsReady, setFontsReady] = useState(0);

  // Name + flag.
  const [name, setName] = useState("YOUR NAME");
  const [flagCode, setFlagCode] = useState("CA");
  const [flagSide, setFlagSide] = useState("right");
  const [flag, setFlag] = useState(null);
  const [nameH, setNameH] = useState(15);

  // Route.
  const [stops, setStops] = useState(START_STOPS);
  const [route, setRoute] = useState(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [routeSize, setRouteSize] = useState("m");
  const [line, setLine] = useState(LINES[0]);

  const bike = bikeOf(bikeKey);
  const tubes = Object.keys(bike.tubes).filter((t) => TUBES[t]);
  const usual = design === "name" ? "top" : "down";
  const tube = [tubeChoice, usual].find((t) => t && bike.tubes[t]) || tubes[0];
  const { stage, ready } = useBikeStage(
    boxRef,
    `3D preview of the sticker on the ${TUBES[tube].toLowerCase()} of a ${bike.name.toLowerCase()} bike. Drag to turn it.`,
  );

  useEffect(() => {
    if (flagSide === "none") return;
    let live = true;
    loadFlag(flagCode).then((img) => live && setFlag(img)).catch(() => live && setFlag(null));
    return () => {
      live = false;
    };
  }, [flagCode, flagSide]);

  // Draw again once the typeface has downloaded.
  useEffect(() => {
    const f = BIKE_FONTS.find((x) => x.family === font);
    Promise.all([document.fonts?.load(`${f.weight} 40px "${f.family}"`), document.fonts?.load('700 40px "Space Grotesk"')])
      .then(() => setFontsReady((n) => n + 1))
      .catch(() => {});
  }, [font]);

  // The route, whenever every stop is a picked place.
  const placed = stops.every((s) => s.place);
  const stopKey = stops.map((s) => s.place && `${s.place.lon},${s.place.lat}`).join(";");
  useEffect(() => {
    if (!placed) return;
    const ctl = new AbortController();
    setRouting(true);
    setRouteError("");
    bikeRoute(stops.map((s) => s.place), ctl.signal)
      // With its start and end names, so the sticker keeps them while a
      // stop is being retyped.
      .then((r) => setRoute({ ...r, from: stops[0].place.short, to: stops[stops.length - 1].place.short }))
      .catch((err) => err.name !== "AbortError" && setRouteError(err.message))
      .finally(() => !ctl.signal.aborted && setRouting(false));
    return () => ctl.abort();
  }, [stopKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const art = useMemo(() => {
    if (typeof document === "undefined") return null;
    if (design === "name") {
      return nameSticker({ name, font, flag: flagSide === "none" ? null : flag, flagSide, bg, ink, h: nameH }, PREVIEW_PX);
    }
    const size = ROUTE_SIZES.find((s) => s.key === routeSize);
    return routeSticker({
      coords: route?.coords,
      from: route?.from,
      to: route?.to,
      km: route?.km,
      font,
      bg,
      ink,
      line,
      w: size.w,
      h: size.h,
    }, PREVIEW_PX);
  }, [design, name, font, flag, flagSide, bg, ink, nameH, route, routeSize, line, fontsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ready) stage.current.setBike(bikeKey);
  }, [ready, bikeKey, stage]);
  useEffect(() => {
    if (ready) stage.current.setPaint(paint);
  }, [ready, paint, stage]);
  useEffect(() => {
    if (ready && art) stage.current.setSticker({ art: art.canvas, w: art.w, h: art.h, tube, at, turn: (turn * Math.PI) / 180, finish: finishKey });
  }, [ready, art, tube, at, turn, finishKey, stage]);
  useEffect(() => {
    if (ready) stage.current.view(view);
  }, [ready, view, stage]);

  // The flat sticker under the 3D view.
  useEffect(() => {
    const c = flatRef.current;
    if (!c || !art) return;
    c.width = art.canvas.width;
    c.height = art.canvas.height;
    c.getContext("2d").drawImage(art.canvas, 0, 0);
  }, [art]);

  const setStop = (i, s) => setStops((ss) => ss.map((x, j) => (j === i ? s : x)));

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
      <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <div ref={boxRef} className="relative aspect-square overflow-hidden rounded-3xl bg-ink ring-1 ring-ink/10 sm:aspect-[4/3]">
          {!ready && (
            <p className="absolute inset-0 flex items-center justify-center font-mono text-xs uppercase tracking-widest text-white/40">
              Loading 3D preview…
            </p>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4 text-white">
            {art && (
              <p className="whitespace-nowrap rounded-full bg-ink/70 px-3 py-1 font-mono text-xs backdrop-blur">
                {Math.round(art.w)} × {Math.round(art.h)} mm<span className="hidden sm:inline"> · {inches(art.w)} × {inches(art.h)} in</span>
              </p>
            )}
            <button
              type="button"
              onClick={() => setView((v) => (v === "sticker" ? "bike" : "sticker"))}
              className="pointer-events-auto flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-ink hover:bg-paper"
            >
              {view === "sticker" ? <><Maximize2 size={14} /> Whole bike</> : <><ScanSearch size={14} /> Close up</>}
            </button>
          </div>
          <p className="pointer-events-none absolute bottom-4 left-4 right-4 font-mono text-[11px] uppercase tracking-widest text-white/55">
            Drag to turn · scroll or pinch to zoom · bike to scale
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-ink/10">
          <div className="flex h-20 w-40 flex-none items-center justify-center rounded-xl bg-[repeating-conic-gradient(#ebe6dc_0_25%,#fff_0_50%)] bg-[length:12px_12px] p-2">
            <canvas ref={flatRef} className="max-h-full max-w-full" />
          </div>
          <p className="text-sm text-ink/60">
            <span className="block font-semibold text-ink">Your sticker, flat</span>
            Printed in full colour on vinyl and cut to this rounded shape. On the bike it
            wraps round the tube.
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <div>
          <Label>Design</Label>
          <div className="grid grid-cols-2 gap-2">
            <Choice active={design === "name"} onClick={() => setDesign("name")} sub="For the top tube">
              Name + flag
            </Choice>
            <Choice active={design === "route"} onClick={() => setDesign("route")} sub="A ride you love, to scale">
              Route
            </Choice>
          </div>
        </div>

        {design === "name" ? (
          <>
            <div>
              <Label hint={`${name.length}/24`}>Name</Label>
              <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} className="field text-base" aria-label="Name" />
            </div>
            <div>
              <Label>Flag</Label>
              <div className="flex flex-wrap gap-2">
                <select
                  value={flagCode}
                  onChange={(e) => setFlagCode(e.target.value)}
                  disabled={flagSide === "none"}
                  className="field min-w-0 flex-1 disabled:opacity-50"
                  aria-label="Flag"
                >
                  {FLAGS.map((f) => (
                    <option key={f.code} value={f.code}>{f.name}</option>
                  ))}
                </select>
                <div className="flex rounded-xl bg-white p-1 ring-1 ring-ink/15">
                  {[["left", "Left"], ["right", "Right"], ["none", "None"]].map(([k, n]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setFlagSide(k)}
                      aria-pressed={flagSide === k}
                      className={clsx("rounded-lg px-3 py-1.5 text-sm", flagSide === k ? "bg-ink text-white" : "hover:bg-paper")}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label hint="the length follows the name">Height</Label>
              <div className="grid grid-cols-4 gap-2">
                {NAME_HEIGHTS.map((h) => (
                  <Choice key={h} active={nameH === h} onClick={() => setNameH(h)}>
                    {h} mm
                  </Choice>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <Label hint="search any address or place">Your ride</Label>
              <div className="space-y-2">
                {stops.map((s, i) => (
                  <PlaceInput
                    key={i}
                    stop={s}
                    onChange={(v) => setStop(i, v)}
                    placeholder={i === 0 ? "Start" : i === stops.length - 1 ? "Finish" : `Stop ${i}`}
                    onRemove={stops.length > 2 ? () => setStops((ss) => ss.filter((_, j) => j !== i)) : null}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                {stops.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setStops((ss) => [...ss.slice(0, -1), { text: "", place: null }, ss[ss.length - 1]])}
                    className="btn-outline-dark h-9 px-3 text-sm"
                  >
                    <Plus size={14} /> Add a stop
                  </button>
                )}
                {placed && (
                  <a
                    href={googleMapsLink(stops.map((s) => s.place))}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm font-medium text-flame hover:underline"
                  >
                    Open in Google Maps <ExternalLink size={14} />
                  </a>
                )}
              </div>
              <p className="mt-2 text-xs text-ink/55">
                {routing ? (
                  <span className="flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Finding a bike route…</span>
                ) : routeError ? (
                  <span className="text-flame-600">{routeError}</span>
                ) : !placed ? (
                  "Pick each place from the list to draw the route."
                ) : route ? (
                  <>Bike route, {route.km.toFixed(1)} km. Route data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a> contributors.</>
                ) : null}
              </p>
            </div>
            <div>
              <Label>Size</Label>
              <div className="grid grid-cols-3 gap-2">
                {ROUTE_SIZES.map((s) => (
                  <Choice key={s.key} active={routeSize === s.key} onClick={() => setRouteSize(s.key)} sub={`${s.w} × ${s.h} mm`}>
                    {s.name}
                  </Choice>
                ))}
              </div>
            </div>
            <div>
              <Label>Route colour</Label>
              <Swatches items={LINES.map((c) => [c, c])} value={line} onChange={setLine} label="Any route colour" />
            </div>
          </>
        )}

        <div>
          <Label>Lettering</Label>
          <div className="flex flex-wrap gap-2">
            {BIKE_FONTS.map((f) => (
              <button
                key={f.family}
                type="button"
                onClick={() => setFont(f.family)}
                aria-pressed={font === f.family}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-base ring-1 transition",
                  font === f.family ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40",
                )}
                style={{ fontFamily: `"${f.family}"`, fontWeight: f.weight }}
              >
                {f.name}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {LABELS.map(([b, i, n], k) => (
              <button
                key={n}
                type="button"
                onClick={() => setLabelKey(k)}
                aria-pressed={labelKey === k}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold ring-2 ring-offset-2 ring-offset-paper",
                  labelKey === k ? "ring-flame" : "ring-transparent hover:ring-ink/20",
                )}
                style={{ background: b, color: i, boxShadow: "inset 0 0 0 1px rgb(12 26 46 / 0.15)" }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Material</Label>
          <div className="grid grid-cols-2 gap-2">
            {stickers.colour.finishes.map((f) => (
              <Choice key={f.key} active={finishKey === f.key} onClick={() => setFinishKey(f.key)} sub={f.body}>
                {f.name}
              </Choice>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/10">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Bike size={16} /> Try it on a bike</p>
          <div className="grid grid-cols-3 gap-2">
            {BIKE_MODELS.map((b) => (
              <Choice key={b.key} active={bikeKey === b.key} onClick={() => setBikeKey(b.key)}>
                {b.name}
              </Choice>
            ))}
          </div>
          <div className="mt-3">
            <Swatches items={PAINTS} value={paint} onChange={setPaint} label="Any frame colour" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {tubes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTube(t)}
                aria-pressed={tube === t}
                className={clsx("rounded-lg px-3 py-1.5 text-sm ring-1", tube === t ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40")}
              >
                {TUBES[t]}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Along the tube
              <input type="range" min={0} max={1} step={0.01} value={at} onChange={(e) => setAt(+e.target.value)} className="mt-1 w-full accent-flame" />
            </label>
            <label className="block text-sm">
              <span className="flex justify-between">Round the tube <span className="text-ink/50">{turn}°</span></span>
              <input type="range" min={-90} max={90} value={turn} onChange={(e) => setTurn(+e.target.value)} className="mt-1 w-full accent-flame" />
            </label>
          </div>
        </div>

        {!available && (
          <div className="rounded-2xl bg-ink p-5 text-white">
            <p className="flex items-center gap-2 font-semibold">
              <span className="rounded-full bg-flame px-2 py-0.5 text-[10px] uppercase tracking-wider">Coming soon</span>
              Bike stickers aren't on sale yet
            </p>
            <p className="mt-2 text-sm text-white/65">
              Design yours here in the meantime. Want some sooner? Send it through a{" "}
              <a href="/#quote" className="font-semibold text-white underline underline-offset-2">free quote</a>
              {" "}and I'll let you know what I can do.
            </p>
          </div>
        )}

        <p className="text-xs text-ink/50">
          Bike models:{" "}
          {BIKE_MODELS.map((b, i) => (
            <span key={b.key}>
              {i > 0 && "; "}
              <a href={b.credit.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
                “{b.credit.title}”
              </a>{" "}
              by {b.credit.author}
            </span>
          ))}
          , all{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
            CC BY 4.0
          </a>
          , recoloured and resized. Flags from country-flag-icons (MIT).
        </p>
      </div>
    </div>
  );
}
