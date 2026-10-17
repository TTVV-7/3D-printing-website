import { useEffect, useMemo, useRef, useState } from "react";
import { Hand, ImageUp, RotateCcw, ShoppingBag, Minus, Plus } from "lucide-react";
import { clsx } from "clsx";
import { stickers } from "../../site.config.js";
import { renderThermal, stickerSize, DOTS_PER_MM } from "./thermal.js";
import { Checkout } from "./Checkout.jsx";

const SHAPES = [
  { key: "rect", name: "Rectangle" },
  { key: "rounded", name: "Rounded" },
  { key: "circle", name: "Circle" },
];
const PRESETS = [
  { mm: 25.4, label: '1"' },
  { mm: 50.8, label: '2"' },
  { mm: 76.2, label: '3"' },
  { mm: 100, label: '4"' },
];

const inches = (mm) => (mm / 25.4).toFixed(2).replace(/\.?0+$/, "");

export function priceEach({ w, h }, finish, qty) {
  const { perSqIn, minEach, glossyExtra, breaks } = stickers.pricing;
  let each = Math.max(minEach, (w / 25.4) * (h / 25.4) * perSqIn);
  if (finish === "glossy") each += glossyExtra;
  const off = breaks.filter((b) => qty >= b.qty).reduce((a, b) => Math.max(a, b.off), 0);
  return each * (1 - off);
}

function loadImage(src) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = fail;
    img.src = src;
  });
}

function useStage(canvasRef) {
  const stage = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("./StickerScene.js")
      .then(({ mountStickers }) => mountStickers(canvasRef.current, { reducedMotion }))
      .then((s) => {
        if (cancelled) return s.dispose();
        stage.current = s;
        setReady(true);
      })
      .catch((err) => console.warn("3D preview skipped:", err));
    return () => {
      cancelled = true;
      stage.current?.dispose();
      stage.current = null;
    };
  }, [canvasRef]);
  return { stage, ready };
}

function Choice({ active, onClick, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-xl px-3 py-2 text-sm font-medium ring-1 transition",
        active ? "bg-ink text-white ring-ink" : "bg-white text-ink ring-ink/15 hover:ring-ink/40",
        className,
      )}
    >
      {children}
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

export function StickerStudio() {
  const canvasRef = useRef(null);
  const flatRef = useRef(null);
  const fileRef = useRef(null);
  const { stage, ready } = useStage(canvasRef);

  const [img, setImg] = useState(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [paper, setPaper] = useState(stickers.papers[0]);
  const [finish, setFinish] = useState("matte");
  const [shape, setShape] = useState("rounded");
  const [widthMm, setWidthMm] = useState(76.2);
  const [mode, setMode] = useState("solid");
  const [threshold, setThreshold] = useState(140);
  const [invert, setInvert] = useState(false);
  const [qty, setQty] = useState(10);
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    loadImage("/stickers/sample.svg").then(setImg).catch(() => {});
  }, []);

  // The narrow side is what the print head limits.
  const size = useMemo(() => {
    const s = stickerSize(img, widthMm, shape);
    const narrow = Math.min(s.w, s.h);
    if (narrow > stickers.maxWidthMm) {
      const k = stickers.maxWidthMm / narrow;
      return { w: +(s.w * k).toFixed(1), h: +(s.h * k).toFixed(1), capped: true };
    }
    return s;
  }, [img, widthMm, shape]);

  const art = useMemo(
    () =>
      typeof document === "undefined"
        ? null
        : renderThermal(img, { w: size.w, h: size.h, shape, marginMm: 2, mode, threshold, invert, paper: paper.hex }),
    [img, size, shape, mode, threshold, invert, paper],
  );

  useEffect(() => {
    if (!ready || !art) return;
    stage.current.update({ art, w: size.w, h: size.h, shape, finish, paper: paper.hex });
    stage.current.start();
  }, [ready, art, size, shape, finish, paper, stage]);

  // The flat, dot-for-dot print preview.
  useEffect(() => {
    const c = flatRef.current;
    if (!c || !art) return;
    c.width = art.width;
    c.height = art.height;
    c.getContext("2d").drawImage(art, 0, 0);
  }, [art]);

  function pick(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    loadImage(url).then((i) => {
      setImg(i);
      setFileName(file.name);
    });
  }

  const each = priceEach(size, finish, qty);
  const total = each * qty;
  const nextBreak = stickers.pricing.breaks.find((b) => qty < b.qty);

  return (
    <section className="bg-paper pb-16 pt-24 sm:pb-24 sm:pt-28">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="eyebrow">Stickers</p>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Your image, as a sticker.</h1>
          <p className="mt-4 text-ink/65 sm:text-lg">
            Thermal printed: crisp black on the paper colour you pick, up to {stickers.maxWidthMm / 10} cm across.
            Drop in an image and see it to scale.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
          {/* Stage */}
          <div className="flex min-w-0 flex-col gap-4">
            <div className="relative aspect-square overflow-hidden rounded-3xl bg-ink ring-1 ring-ink/10 sm:aspect-[4/3]">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label="3D preview of the sticker beside a credit card for scale. Drag to turn it."
                className="absolute inset-0 h-full w-full cursor-grab touch-pan-y active:cursor-grabbing"
              />
              {!ready && (
                <p className="absolute inset-0 flex items-center justify-center font-mono text-xs uppercase tracking-widest text-white/40">
                  Loading 3D preview…
                </p>
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 text-white">
                <p className="rounded-full bg-ink/70 px-3 py-1 font-mono text-xs backdrop-blur">
                  {size.w} × {size.h} mm · {inches(size.w)} × {inches(size.h)} in
                </p>
                <button
                  type="button"
                  onClick={() => stage.current?.resetView()}
                  className="pointer-events-auto rounded-full bg-ink/70 p-2 backdrop-blur hover:bg-ink"
                  aria-label="Reset view"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
              <p className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-white/55">
                <Hand size={14} /> Drag to turn<span className="hidden sm:inline"> · scroll to zoom</span> · grid is 1 cm
              </p>
            </div>

            <div className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-ink/10">
              <div
                className="flex h-24 w-24 flex-none items-center justify-center rounded-xl bg-[repeating-conic-gradient(#ebe6dc_0_25%,#fff_0_50%)] bg-[length:12px_12px]"
              >
                <canvas ref={flatRef} className="max-h-20 max-w-20 [image-rendering:pixelated]" />
              </div>
              <div className="text-sm">
                <p className="font-semibold">Print preview, dot for dot</p>
                <p className="mt-1 text-ink/60">
                  What the printer puts down at {Math.round(DOTS_PER_MM * 25.4)} dpi:{" "}
                  {art?.width} × {art?.height} dots. Thermal is one ink, so greys become solid
                  black or a dot pattern.
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex min-w-0 flex-col gap-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files[0]);
              }}
              onClick={() => fileRef.current?.click()}
              className={clsx(
                "flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-4 transition",
                dragging ? "border-flame bg-flame-100" : "border-ink/20 bg-white hover:border-ink/40",
              )}
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-flame/10 text-flame">
                <ImageUp size={20} />
              </span>
              <span className="min-w-0 text-sm">
                <span className="block font-semibold">{fileName ? "Change image" : "Upload your image"}</span>
                <span className="block truncate text-ink/55">
                  {fileName || "PNG, JPG or SVG. Drop it here or click. Logos and line art print best."}
                </span>
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pick(e.target.files[0])}
              />
            </div>

            <div>
              <Label hint="ink is always black">Paper colour</Label>
              <div className="flex flex-wrap gap-2">
                {stickers.papers.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPaper(p)}
                    aria-pressed={paper.key === p.key}
                    title={p.name}
                    className={clsx(
                      "h-10 w-10 rounded-full ring-2 ring-offset-2 ring-offset-paper transition",
                      paper.key === p.key ? "ring-flame" : "ring-transparent hover:ring-ink/20",
                    )}
                    style={{ background: p.hex, boxShadow: "inset 0 0 0 1px rgb(12 26 46 / 0.15)" }}
                  >
                    <span className="sr-only">{p.name}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-ink/50">{paper.name}</p>
            </div>

            <div>
              <Label>Finish</Label>
              <div className="grid grid-cols-2 gap-2">
                {stickers.finishes.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFinish(f.key)}
                    aria-pressed={finish === f.key}
                    className={clsx(
                      "rounded-xl p-3 text-left ring-1 transition",
                      finish === f.key ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40",
                    )}
                  >
                    <span className="block text-sm font-semibold">{f.name}</span>
                    <span className={clsx("block text-xs", finish === f.key ? "text-white/60" : "text-ink/55")}>
                      {f.body}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Shape</Label>
              <div className="flex gap-2">
                {SHAPES.map((s) => (
                  <Choice key={s.key} active={shape === s.key} onClick={() => setShape(s.key)} className="flex-1">
                    {s.name}
                  </Choice>
                ))}
              </div>
            </div>

            <div>
              <Label hint={`${size.w} × ${size.h} mm`}>Size</Label>
              <input
                type="range"
                min={stickers.minWidthMm}
                max={stickers.maxWidthMm}
                step={0.5}
                value={Math.min(widthMm, stickers.maxWidthMm)}
                onChange={(e) => setWidthMm(+e.target.value)}
                className="w-full accent-flame"
                aria-label="Width in millimetres"
              />
              <div className="mt-2 flex gap-2">
                {PRESETS.map((p) => (
                  <Choice key={p.label} active={Math.abs(widthMm - p.mm) < 0.3} onClick={() => setWidthMm(p.mm)} className="flex-1">
                    {p.label}
                  </Choice>
                ))}
              </div>
              {size.capped && (
                <p className="mt-2 text-xs text-flame-600">
                  Capped so the narrow side fits the {stickers.maxWidthMm} mm print head.
                </p>
              )}
            </div>

            <details className="rounded-2xl bg-white p-4 ring-1 ring-ink/10">
              <summary className="cursor-pointer text-sm font-semibold">Ink settings</summary>
              <div className="mt-4 space-y-4">
                <div className="flex gap-2">
                  <Choice active={mode === "solid"} onClick={() => setMode("solid")} className="flex-1">
                    Solid
                  </Choice>
                  <Choice active={mode === "dither"} onClick={() => setMode("dither")} className="flex-1">
                    Dotted (for photos)
                  </Choice>
                </div>
                <label className="block text-sm">
                  <span className="flex justify-between">
                    Darkness <span className="text-ink/50">{threshold}</span>
                  </span>
                  <input
                    type="range"
                    min={20}
                    max={240}
                    value={threshold}
                    onChange={(e) => setThreshold(+e.target.value)}
                    className="mt-1 w-full accent-flame"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} className="accent-flame" />
                  Invert (light design on a black sticker)
                </label>
              </div>
            </details>

            <div className="rounded-2xl bg-ink p-5 text-white">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center rounded-full bg-white/10">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-2.5" aria-label="One fewer">
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Math.floor(+e.target.value) || 1))}
                    className="w-14 bg-transparent text-center font-mono [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
                    aria-label="Quantity"
                  />
                  <button type="button" onClick={() => setQty((q) => q + 1)} className="p-2.5" aria-label="One more">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-bold">${total.toFixed(2)}</p>
                  <p className="text-xs text-white/55">${each.toFixed(2)} each · CAD</p>
                </div>
              </div>
              {nextBreak && (
                <p className="mt-3 text-xs text-white/55">
                  Order {nextBreak.qty}+ for {Math.round(nextBreak.off * 100)}% off each.
                </p>
              )}
              <button type="button" onClick={() => setCheckout(true)} className="btn-primary mt-4 w-full">
                <ShoppingBag size={18} /> Check out
              </button>
            </div>
          </div>
        </div>
      </div>

      {checkout && (
        <Checkout
          onClose={() => setCheckout(false)}
          order={{ art, size, shape, finish, paper, qty, each, total }}
        />
      )}
    </section>
  );
}
