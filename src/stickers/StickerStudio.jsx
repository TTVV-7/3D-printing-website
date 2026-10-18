import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check, CheckCircle2, X, Crosshair, Hand, ImageUp, ImagePlus, Pencil, RotateCcw, ShoppingBag, Minus, Plus, Trash2, Type,
} from "lucide-react";
import { clsx } from "clsx";
import { stickers } from "../../site.config.js";
import { renderThermal, printFile, DOTS_PER_MM } from "./thermal.js";
import { DesignControls } from "./DesignControls.jsx";

import { StickerEditor } from "./StickerEditor.jsx";
import { Checkout } from "./Checkout.jsx";
import { priceEach, sizeOf, lineTotal, itemLabel, finishesFor } from "./pricing.js";

// Typefaces for text layers; loaded in stickers/index.html.
const FONTS = [
  { family: "Bungee", name: "Bungee", weight: 400 },
  { family: "Space Grotesk", name: "Grotesk", weight: 700 },
  { family: "Bebas Neue", name: "Bebas", weight: 400 },
  { family: "Permanent Marker", name: "Marker", weight: 400 },
  { family: "Pacifico", name: "Script", weight: 400 },
  { family: "Special Elite", name: "Typewriter", weight: 400 },
];
const fontOf = (family) => FONTS.find((f) => f.family === family) || FONTS[0];

// The cart lives in this browser, so it survives a reload or a trip to Stripe
// and back. Each line holds its print-ready PNG, a few kB.
const MAX_CART = 20;
function useCart() {
  const [cart, setCart] = useState([]);
  useEffect(() => {
    try {
      // Drop lines for label sizes no longer offered.
      const saved = JSON.parse(localStorage.getItem("sticker-cart")) || [];
      setCart(saved.filter((it) => sizeOf(it.sizeKey)));
    } catch {
      // No storage (private window): the cart just won't outlast the page.
    }
  }, []);
  const save = (next) =>
    setCart((cur) => {
      const value = typeof next === "function" ? next(cur) : next;
      try {
        localStorage.setItem("sticker-cart", JSON.stringify(value));
      } catch {
        // Full or blocked storage: keep it in memory.
      }
      return value;
    });
  return [cart, save];
}

let nextId = 1;
const newId = () => `l${nextId++}`;
const imageLayer = (img) => ({ id: newId(), kind: "image", img, x: 0, y: 0, scale: 1, rot: 0 });

const inches = (mm) => (mm / 25.4).toFixed(2).replace(/\.?0+$/, "");

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
  const editFileRef = useRef(null);
  const { stage, ready } = useStage(canvasRef);

  const [layers, setLayers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [fontsReady, setFontsReady] = useState(0); // bumps when a typeface arrives
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [finishKey, setFinishKey] = useState(stickers.finishes[0].key);
  const [colourKeys, setColourKeys] = useState({}); // last colour picked per finish
  const [realCard, setRealCard] = useState(false);
  // Label size, background design and edge ring (DesignControls).
  const [d, setD] = useState({ sizeKey: "round-2in", pattern: "none", patternSeed: 7, ring: "none" });
  // Only the label colours sold in this size; a pick that isn't falls back
  // to the first that is (white matte).
  const finishes = finishesFor(d.sizeKey);
  const finishDef = finishes.find((f) => f.key === finishKey) || finishes[0];
  const colour = finishDef.colours.find((c) => c.key === colourKeys[finishDef.key]) || finishDef.colours[0];
  const finish = finishDef.key;
  const paper = colour.hex;
  const setDesign = (patch) => setD((cur) => ({ ...cur, ...patch }));
  const [mode, setMode] = useState("solid");
  const [threshold, setThreshold] = useState(140);
  const [invert, setInvert] = useState(false);
  const [qty, setQty] = useState(10);
  const [checkout, setCheckout] = useState(false);
  const [cart, setCart] = useCart();
  const [added, setAdded] = useState(false);

  useEffect(() => {
    loadImage("/stickers/sample.webp")
      .then((img) => setLayers((ls) => (ls.length ? ls : [imageLayer(img)])))
      .catch(() => {});
  }, []);

  const stock = sizeOf(d.sizeKey);
  const size = useMemo(() => ({ w: stock.w, h: stock.h }), [stock]);
  // No cutting: the sticker is the shape of its label.
  const crop = stock.crop || "none";


  const art = useMemo(
    () =>
      typeof document === "undefined"
        ? null
        : renderThermal({ ...d, crop, layers }, { w: size.w, h: size.h, mode, threshold, invert, paper }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layers, size, d, mode, threshold, invert, paper, fontsReady],
  );

  useEffect(() => {
    // While editing, the 3D view is hidden: catch it up when editing ends.
    if (!ready || !art || editing) return;
    stage.current.update({ art, w: size.w, h: size.h, crop, finish, paper });
    stage.current.onCardClick(() => setRealCard((r) => !r));
    stage.current.onStickerClick(() => setEditing(true));
    stage.current.start();
  }, [ready, art, size, crop, finish, paper, stage, editing]);

  useEffect(() => {
    if (ready) stage.current.cardLook(realCard);
  }, [ready, realCard, stage]);

  // The flat, dot-for-dot print preview.
  useEffect(() => {
    const c = flatRef.current;
    if (!c || !art) return;
    c.width = art.width;
    c.height = art.height;
    c.getContext("2d").drawImage(art, 0, 0);
  }, [art]);

  // A new image replaces the current one (keeping any text), or is added
  // as a second image while editing.
  function pick(file, add = false) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    loadImage(url).then((img) => {
      const layer = imageLayer(img);
      setLayers((ls) => {
        const i = ls.findIndex((l) => l.kind === "image");
        if (add || i === -1) return [...ls, layer];
        return ls.map((l, j) => (j === i ? layer : l));
      });
      setSelected(layer.id);
      setFileName(file.name);
    });
  }

  // Each new text lands somewhere new, so they don't stack up unseen.
  const TEXT_SPOTS = [0.3, -0.3, 0, 0.15, -0.15];
  function addText() {
    const font = FONTS[0];
    const n = layers.filter((l) => l.kind === "text").length;
    const layer = { id: newId(), kind: "text", text: "Your text", font: font.family, weight: font.weight, size: 0.14, x: 0, y: TEXT_SPOTS[n % TEXT_SPOTS.length] * (size.h / size.w), scale: 1, rot: 0 };
    setLayers((ls) => [...ls, layer]);
    setSelected(layer.id);
    setEditing(true);
  }

  // Removes a layer and selects the one next to it, so the next Remove works.
  function removeLayer(id) {
    const i = layers.findIndex((l) => l.id === id);
    const rest = layers.filter((l) => l.id !== id);
    setLayers(rest);
    setSelected(rest[Math.min(i, rest.length - 1)]?.id ?? null);
  }

  // Delete / Backspace removes the selected layer while editing (not while typing).
  useEffect(() => {
    if (!editing) return;
    const onKey = (e) => {
      if (!["Delete", "Backspace"].includes(e.key) || !selected) return;
      if (e.target.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      removeLayer(selected);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Images re-fit whenever the label or ring changes, so they always fill it.
  useEffect(() => {
    setLayers((ls) => ls.map((l) => (l.kind === "image" ? { ...l, scale: 1, x: 0, y: 0 } : l)));
  }, [d.sizeKey, d.ring]);

  const sel = layers.find((l) => l.id === selected);
  const patchSel = (patch) => setLayers((ls) => ls.map((l) => (l.id === selected ? { ...l, ...patch } : l)));

  // Draw again once a typeface has downloaded.
  useEffect(() => {
    const fams = [...new Set(layers.filter((l) => l.kind === "text").map((l) => l.font))];
    if (!fams.length || !document.fonts) return;
    Promise.all(fams.map((f) => document.fonts.load(`${fontOf(f).weight} 40px "${f}"`)))
      .then(() => setFontsReady((n) => n + 1))
      .catch(() => {});
  }, [layers.map((l) => l.font).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back from Stripe: /stickers/?paid=<session id>.
  const [paid, setPaid] = useState(false);
  useEffect(() => {
    const session = new URLSearchParams(location.search).get("paid");
    if (!session) return;
    setPaid(true);
    setCart([]); // paid for: start fresh
    // Files the order and emails it (api/sticker-confirm.js). Only once per
    // order, however often this runs.
    fetch("/api/sticker-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
    }).catch(() => {});
    history.replaceState(null, "", location.pathname);
  }, []);

  const each = priceEach(size, finish, qty);
  const total = each * qty;
  const nextBreak = stickers.pricing.breaks.find((b) => qty < b.qty);

  // The sticker on screen, as a cart line: its print-ready image and every
  // setting needed to price, print and make it again.
  const cartItem = () => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    art: art.toDataURL("image/png"), // the preview, for the cart
    print: printFile(art), // what gets printed (thermal.js)
    sizeKey: d.sizeKey,
    ring: d.ring,
    finishKey: finishDef.key,
    colourKey: colour.key,
    qty,
    ink: { mode, threshold, invert },
    fileName,
  });
  function addToCart() {
    setCart((c) => [...c, cartItem()].slice(-MAX_CART));
    setAdded(true);
  }
  // Something changed since it went in: the button offers to add it again.
  useEffect(() => setAdded(false), [art, qty, finishDef, colour]);
  const cartTotal = cart.reduce((sum, it) => sum + lineTotal(it), 0);

  return (
    <section className="bg-paper pb-16 pt-24 sm:pb-24 sm:pt-28">
      <div className="container-page">
        {paid && (
          <div className="mb-8 flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-flame/40">
            <CheckCircle2 size={22} className="mt-0.5 flex-none text-flame" />
            <p className="text-sm">
              <span className="font-semibold">Order received, thank you!</span> A receipt is on its
              way by email. Your card is charged when the stickers are printed, usually within two
              business days.
            </p>
          </div>
        )}
        <div className="max-w-2xl">
          <p className="eyebrow">Stickers</p>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Your image, as a sticker.</h1>
          <p className="mt-4 text-ink/65 sm:text-lg">
            Thermal printed in crisp black on die-cut labels. Drop in an image or type some text,
            pick a label and a border, and see it to scale.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
          {/* Stage: stays in view while the options scroll past */}
          <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
            <div className="relative aspect-square overflow-hidden rounded-3xl bg-ink ring-1 ring-ink/10 sm:aspect-[4/3]">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label="3D preview of the sticker beside a credit card for scale. Drag to turn it."
                className="absolute inset-0 h-full w-full cursor-grab touch-pan-y active:cursor-grabbing"
              />
              {!ready && !editing && (
                <p className="absolute inset-0 flex items-center justify-center font-mono text-xs uppercase tracking-widest text-white/40">
                  Loading 3D preview…
                </p>
              )}
              {editing && (
                <StickerEditor
                  art={art}
                  sticker={{ w: size.w, h: size.h, crop, ring: d.ring }}
                  layers={layers}
                  selected={selected}
                  onSelect={setSelected}
                  onChange={setLayers}
                />
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4 text-white">
                <p className="rounded-full bg-ink/70 px-3 py-1 font-mono text-xs backdrop-blur">
                  {size.w} × {size.h} mm · {inches(size.w)} × {inches(size.h)} in
                </p>
                {editing ? (
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-flame px-4 py-1.5 text-sm font-semibold hover:bg-flame-600"
                  >
                    <Check size={15} /> Done, show in 3D
                  </button>
                ) : (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-ink hover:bg-paper"
                    >
                      <Pencil size={14} /> Edit design
                    </button>
                    <button
                      type="button"
                      onClick={() => stage.current?.resetView()}
                      className="pointer-events-auto rounded-full bg-ink/70 p-2 backdrop-blur hover:bg-ink"
                      aria-label="Reset view"
                    >
                      <RotateCcw size={15} />
                    </button>
                  </span>
                )}
              </div>
              <p className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-white/55">
                {editing ? (
                  <>
                    <Hand size={14} /> Drag to move · corner to scale and turn
                    <span className="hidden sm:inline"> · scroll to resize</span>
                  </>
                ) : (
                  <>
                    <Hand size={14} /> Click the sticker to edit · drag to turn
                    <span className="hidden sm:inline"> · grid is 1 cm</span>
                  </>
                )}
              </p>
            </div>
            <p className="-mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-sm text-ink/60">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm ring-1 ring-ink/20" style={{ background: paper }} /> Your sticker
              </span>
              <button
                type="button"
                onClick={() => setRealCard((r) => !r)}
                aria-pressed={realCard}
                className="flex items-center gap-2 rounded-full py-0.5 hover:text-ink"
              >
                <span
                  className={clsx(
                    "h-3 w-4 rounded-sm",
                    realCard ? "bg-gradient-to-br from-ink-600 to-ink" : "border border-dashed border-ink/40 bg-ink/5",
                  )}
                />
                A credit card, for scale
                <span className="text-flame underline-offset-2 hover:underline">
                  {realCard ? "show as outline" : "show as a real card"}
                </span>
              </button>
            </p>

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
            {editing && (
              <div className="rounded-2xl bg-white p-4 ring-2 ring-flame/60">
                <p className="mb-3 text-sm font-semibold">Editing your design</p>
                <div className="flex flex-wrap items-center gap-2">
                  {layers.map((l) => (
                    <span
                      key={l.id}
                      data-layer-chip
                      className={clsx(
                        "inline-flex max-w-[12rem] items-center rounded-xl text-sm font-medium ring-1 transition",
                        l.id === selected ? "bg-ink text-white ring-ink" : "bg-white text-ink ring-ink/15 hover:ring-ink/40",
                      )}
                    >
                      <button type="button" onClick={() => setSelected(l.id)} className="truncate py-2 pl-3 pr-1.5">
                        {l.kind === "image" ? "Image" : `“${l.text.split("\n")[0] || "Text"}”`}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLayer(l.id)}
                        aria-label="Remove"
                        className="mr-1 rounded-lg p-1 opacity-70 hover:bg-flame hover:text-white hover:opacity-100"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                  <button type="button" onClick={addText} className="btn-outline-dark h-9 px-3 text-sm">
                    <Type size={15} /> Add text
                  </button>
                  <button type="button" onClick={() => editFileRef.current?.click()} className="btn-outline-dark h-9 px-3 text-sm">
                    <ImagePlus size={15} /> Add image
                  </button>
                  <input
                    ref={editFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      pick(e.target.files[0], true);
                      e.target.value = "";
                    }}
                  />
                </div>

                {sel ? (
                  <div className="mt-4 space-y-3">
                    {sel.kind === "text" && (
                      <>
                        <textarea
                          value={sel.text}
                          onChange={(e) => patchSel({ text: e.target.value })}
                          rows={sel.text.includes("\n") ? 2 : 1}
                          className="field resize-none text-base"
                          aria-label="Text"
                        />
                        <div className="flex flex-wrap gap-2">
                          {FONTS.map((f) => (
                            <button
                              key={f.family}
                              type="button"
                              onClick={() => patchSel({ font: f.family, weight: f.weight })}
                              aria-pressed={sel.font === f.family}
                              className={clsx(
                                "rounded-lg px-3 py-1.5 text-base ring-1 transition",
                                sel.font === f.family ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40",
                              )}
                              style={{ fontFamily: `"${f.family}"`, fontWeight: f.weight }}
                            >
                              {f.name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm">
                        <span className="flex justify-between">
                          Size <span className="text-ink/50">{Math.round(sel.scale * 100)}%</span>
                        </span>
                        <input
                          type="range"
                          min={0.1}
                          max={3}
                          step={0.01}
                          value={sel.scale}
                          onChange={(e) => patchSel({ scale: +e.target.value })}
                          className="mt-1 w-full accent-flame"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="flex justify-between">
                          Turn <span className="text-ink/50">{Math.round((sel.rot * 180) / Math.PI)}°</span>
                        </span>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          value={Math.round((sel.rot * 180) / Math.PI)}
                          onChange={(e) => patchSel({ rot: (+e.target.value * Math.PI) / 180 })}
                          className="mt-1 w-full accent-flame"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => patchSel({ x: 0, y: 0 })} className="btn-outline-dark h-9 px-3 text-sm">
                        <Crosshair size={15} /> Centre
                      </button>
                      <button type="button" onClick={() => patchSel({ scale: 1, rot: 0, x: 0, y: 0 })} className="btn-outline-dark h-9 px-3 text-sm">
                        <RotateCcw size={15} /> Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLayer(selected)}
                        className="btn-outline-dark h-9 px-3 text-sm text-flame-600"
                      >
                        <Trash2 size={15} /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-ink/55">Click something on the sticker to move, size or turn it.</p>
                )}
              </div>
            )}

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
                  {fileName || "PNG, JPG or SVG. Drop it here or click. Line art prints best."}
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

            <button type="button" onClick={addText} className="btn-outline-dark -mt-3 h-11 w-full text-sm">
              <Type size={16} /> Add text to your sticker
            </button>

            <div>
              <Label hint="for your image; designs and text stay crisp">Image ink</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["solid", "Solid black", "Bold and clean. Best for logos and drawings."],
                  ["dither", "Dotted", "Shades as dot patterns. Best for photos."],
                ].map(([k, name, body]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMode(k)}
                    aria-pressed={mode === k}
                    className={clsx(
                      "rounded-xl p-3 text-left ring-1 transition",
                      mode === k ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40",
                    )}
                  >
                    <span className="block text-sm font-semibold">{name}</span>
                    <span className={clsx("mt-0.5 block text-xs", mode === k ? "text-white/60" : "text-ink/55")}>{body}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label hint={finishes.length === 1 && finishDef.colours.length === 1 ? `only ${colour.name.toLowerCase()} in this size` : "ink is always black"}>
                Finish
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {finishes.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFinishKey(f.key)}
                    aria-pressed={finish === f.key}
                    className={clsx(
                      "rounded-xl p-3 text-left ring-1 transition",
                      finish === f.key ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span
                        className="h-4 w-4 rounded-full ring-1 ring-black/10"
                        style={{
                          background:
                            f.key === "chrome"
                              ? "linear-gradient(135deg,#f4f5f7 0%,#9aa1ab 45%,#eef0f3 60%,#7d848f 100%)"
                              : f.colours[0].hex,
                        }}
                      />
                      {f.name}
                    </span>
                    <span className={clsx("mt-0.5 block text-xs", finish === f.key ? "text-white/60" : "text-ink/55")}>
                      {f.body}
                    </span>
                  </button>
                ))}
              </div>

              {finishDef.colours.length > 1 && (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-2">
                    {finishDef.colours.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setColourKeys((k) => ({ ...k, [finishDef.key]: c.key }))}
                        aria-pressed={colour.key === c.key}
                        title={c.name}
                        className={clsx(
                          "h-9 w-9 rounded-full ring-2 ring-offset-2 ring-offset-paper transition",
                          colour.key === c.key ? "ring-flame" : "ring-transparent hover:ring-ink/20",
                        )}
                        style={{ background: c.hex, boxShadow: "inset 0 0 0 1px rgb(12 26 46 / 0.15)" }}
                      >
                        <span className="sr-only">{c.name}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-ink/50">{colour.name}</p>
                </div>
              )}
            </div>

            <DesignControls d={d} set={setDesign} />

            <details className="rounded-2xl bg-white p-4 ring-1 ring-ink/10">
              <summary className="cursor-pointer text-sm font-semibold">Darkness and invert</summary>
              <div className="mt-4 space-y-4">
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
              <button
                type="button"
                onClick={addToCart}
                disabled={added}
                className={clsx("btn mt-4 w-full", added ? "bg-white/10 text-white/70" : "bg-white text-ink hover:bg-paper")}
              >
                {added ? <><Check size={18} /> In your cart. Design another?</> : <><Plus size={18} /> Add to cart</>}
              </button>
            </div>

            {cart.length > 0 && (
              <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/10" id="sticker-cart">
                <p className="flex items-baseline justify-between text-sm font-semibold">
                  Your cart
                  <span className="font-normal text-ink/50">
                    {cart.length} design{cart.length > 1 ? "s" : ""} · {cart.reduce((n, it) => n + it.qty, 0)} stickers
                  </span>
                </p>
                <ul className="mt-3 divide-y divide-ink/10">
                  {cart.map((it) => (
                    <li key={it.id} className="flex items-center gap-3 py-2">
                      <img src={it.art} alt="" className="h-11 w-11 flex-none rounded-lg bg-paper-dark object-contain p-1 [image-rendering:pixelated]" />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block truncate font-medium">{it.qty} × {sizeOf(it.sizeKey).name}</span>
                        <span className="block truncate text-xs text-ink/55">{itemLabel(it)}</span>
                      </span>
                      <span className="text-sm font-semibold">${lineTotal(it).toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => setCart((c) => c.filter((x) => x.id !== it.id))}
                        aria-label="Remove from cart"
                        className="rounded-lg p-1.5 text-ink/50 hover:bg-flame hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setCheckout(true)} className="btn-primary mt-3 w-full">
                  <ShoppingBag size={18} /> Check out · ${cartTotal.toFixed(2)}
                </button>
              </div>
            )}
            {!cart.length && (
              <button
                type="button"
                onClick={() => {
                  addToCart();
                  setCheckout(true);
                }}
                className="btn-primary -mt-3 w-full"
              >
                <ShoppingBag size={18} /> Check out just this one
              </button>
            )}
          </div>
        </div>
      </div>

      {checkout && (
        <Checkout
          onClose={() => setCheckout(false)}
          items={cart}
          onRemove={(id) => setCart((c) => c.filter((x) => x.id !== id))}
          onSent={() => {
            setCheckout(false);
            setCart([]); // requested: start fresh
          }}
        />
      )}
    </section>
  );
}
