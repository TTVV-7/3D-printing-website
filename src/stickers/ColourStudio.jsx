import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Check, Crop, Hand, ImageUp, Loader2, Minus, Plus, RotateCcw, ShoppingBag, Trash2, Type } from "lucide-react";
import { clsx } from "clsx";
import { stickers } from "../../site.config.js";
import { COLOUR_SHAPES, colourFits, priceColourEach } from "./pricing.js";
import {
  BORDERS, inspect, prepareArt, layout, widthRange, renderSticker, printFile,
  PLACE_START, ZOOM, placeKind, clampPlace, cropArt, cropImage, addText, TEXT_COLOURS, backdropColour,
} from "./colour.js";
import { removeBackground, warmUp } from "./cutout.js";
import { FONTS, fontOf } from "./fonts.js";
import { uploadArt } from "./Checkout.jsx";
import { CropDialog } from "./CropDialog.jsx";
import { AiSticker, STICKER_AI } from "./AiSticker.jsx";

// The full-colour, custom-cut sticker maker: printed on the inkjet, cut on
// the Cricut (colour.js). Shares the cart and checkout with the thermal
// maker in StickerStudio.jsx, which renders this in its place.

const cfg = stickers.colour;
const CARD = { w: 85.6, h: 53.98 }; // a credit card, for scale
const BACKINGS = [
  ["#ffffff", "White"],
  ["#0c1a2e", "Navy"],
  ["#111111", "Black"],
  ["#f7d84a", "Yellow"],
  ["#f4a7c0", "Pink"],
  ["#8fc3ea", "Blue"],
];
const inches = (mm) => (mm / 25.4).toFixed(1);

function loadImage(src) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = fail;
    img.src = src;
  });
}

function Choice({ active, onClick, children, sub, onPointerEnter }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={onPointerEnter}
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

// A credit card for scale, drawn at (x, y) top-left in canvas px. `t` runs
// 0..1 as it pops into place: dropping in from a little above, with a
// bounce, like the thermal maker's 3D card.
function drawCard(ctx, x, y, pxPerMm, dpr, t) {
  if (t <= 0) return;
  const w = CARD.w * pxPerMm, h = CARD.h * pxPerMm, r = 3.2 * pxPerMm;
  const back = 1.70158, u = t - 1;
  const pop = 1 + (back + 1) * u ** 3 + back * u ** 2; // ease out, overshooting a touch
  const scale = 0.75 + 0.25 * pop;
  ctx.save();
  ctx.globalAlpha = Math.min(1, t * 2);
  ctx.translate(x + w / 2, y + h / 2 - (1 - pop) * 18 * dpr);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  // Card, with a soft shadow on the mat.
  ctx.shadowColor = "rgba(12,26,46,0.22)";
  ctx.shadowBlur = 12 * dpr;
  ctx.shadowOffsetY = 4 * dpr;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "rgba(244,247,250,0.92)");
  g.addColorStop(1, "rgba(214,224,233,0.92)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(12,26,46,0.18)";
  ctx.lineWidth = 1 * dpr;
  ctx.stroke();
  // Chip, and the wording.
  const chip = ctx.createLinearGradient(0, 0, 11 * pxPerMm, 9 * pxPerMm);
  chip.addColorStop(0, "#e2c46b");
  chip.addColorStop(1, "#b8963e");
  ctx.fillStyle = chip;
  ctx.beginPath();
  ctx.roundRect(8 * pxPerMm, 17 * pxPerMm, 11 * pxPerMm, 8.5 * pxPerMm, 1.4 * pxPerMm);
  ctx.fill();
  ctx.fillStyle = "rgba(12,26,46,0.55)";
  ctx.textAlign = "center";
  ctx.font = `700 ${Math.max(9 * dpr, 6.5 * pxPerMm)}px "Space Grotesk", ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText("FOR SCALE", w / 2, h * 0.58);
  ctx.fillStyle = "rgba(12,26,46,0.4)";
  ctx.font = `${Math.max(7 * dpr, 3 * pxPerMm)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText("Credit card · 85.6 × 54 mm", w / 2, h * 0.78);
  ctx.restore();
}

// The sticker to scale on a cutting mat (1 cm grid), beside a credit card.
// The thin dark edge is the cut line.
// Dragging on it reports how far the pointer moved in sticker millimetres
// (onPan); the wheel or a two-finger pinch reports a zoom factor (onZoom).
function Stage({ art, opts, width, onPan, onZoom }) {
  const boxRef = useRef(null);
  const scaleRef = useRef(1); // canvas px per mm, from the last draw
  const pointers = useRef(new Map());
  const canvasRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  // Wheel to zoom, without scrolling the page (needs a non-passive listener).
  const zoomRef = useRef(onZoom);
  zoomRef.current = onZoom;
  useEffect(() => {
    const c = canvasRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      zoomRef.current(Math.exp(-e.deltaY * 0.0015));
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);

  // When the card first popped into place (it does once, on first showing).
  const popAt = useRef(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !box.w || !art) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(box.w * dpr);
    c.height = Math.round(box.h * dpr);
    const ctx = c.getContext("2d");
    const l = layout(art, opts, width);
    const gap = 14;
    const sceneW = l.w + gap + CARD.w;
    const sceneH = Math.max(l.h, CARD.h);
    const pxPerMm = Math.min((c.width * 0.86) / sceneW, (c.height * 0.8) / sceneH);
    scaleRef.current = pxPerMm / dpr;
    const ox = (c.width - sceneW * pxPerMm) / 2;
    const oy = (c.height - sceneH * pxPerMm) / 2;

    // The sticker at the screen's own resolution (not stretched up, which
    // blurred it), its cut-line silhouette, and where they go.
    const { canvas: st } = renderSticker(art, opts, width, Math.min(30, pxPerMm));
    const edge = document.createElement("canvas");
    edge.width = st.width;
    edge.height = st.height;
    const ectx = edge.getContext("2d");
    ectx.drawImage(st, 0, 0);
    ectx.globalCompositeOperation = "source-in";
    ectx.fillStyle = "rgba(12,26,46,0.55)";
    ectx.fillRect(0, 0, edge.width, edge.height);
    const sw = l.w * pxPerMm, sh = l.h * pxPerMm;
    const sx = ox, sy = oy + (sceneH - l.h) * pxPerMm / 2;

    // Mat, grid, the card (`t` 0..1 as it pops in), then the sticker on top.
    const paint = (t) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#e9efe9";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.strokeStyle = "rgba(12,26,46,0.08)";
      ctx.lineWidth = 1;
      const step = 10 * pxPerMm;
      for (let x = ox % step; x < c.width; x += step) ctx.strokeRect(Math.round(x) + 0.5, -1, 0, c.height + 2);
      for (let y = oy % step; y < c.height; y += step) ctx.strokeRect(-1, Math.round(y) + 0.5, c.width + 2, 0);

      drawCard(ctx, ox + (l.w + gap) * pxPerMm, oy + (sceneH - CARD.h) * pxPerMm / 2, pxPerMm, dpr, t);

      ctx.save();
      ctx.shadowColor = "rgba(12,26,46,0.28)";
      ctx.shadowBlur = 14 * dpr;
      ctx.shadowOffsetY = 5 * dpr;
      ctx.drawImage(edge, sx, sy, sw, sh);
      ctx.restore();
      const e = 1.1 * dpr;
      for (const [dx, dy] of [[e, 0], [-e, 0], [0, e], [0, -e]]) ctx.drawImage(edge, sx + dx, sy + dy, sw, sh);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(st, sx, sy, sw, sh);
    };

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      paint(1);
      return;
    }
    popAt.current ??= performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - popAt.current) / 550);
      paint(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    tick(performance.now());
    return () => cancelAnimationFrame(raf);
  }, [art, opts, width, box]);

  return (
    <div ref={boxRef} className="relative aspect-square overflow-hidden rounded-3xl ring-1 ring-ink/10 sm:aspect-[4/3]">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Your sticker to scale beside a credit card. The thin dark edge is where it's cut. Drag to move the image."
        className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }}
        onPointerMove={(e) => {
          const ps = pointers.current;
          const last = ps.get(e.pointerId);
          if (!last) return;
          if (ps.size === 2) {
            // Pinch: the change in distance between the two fingers.
            const [a, b] = [...ps.values()];
            const before = Math.hypot(a.x - b.x, a.y - b.y);
            ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const [c, d] = [...ps.values()];
            const after = Math.hypot(c.x - d.x, c.y - d.y);
            if (before > 0) onZoom(after / before);
            return;
          }
          ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
          onPan((e.clientX - last.x) / scaleRef.current, (e.clientY - last.y) / scaleRef.current);
        }}
        onPointerUp={(e) => pointers.current.delete(e.pointerId)}
        onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
      />
    </div>
  );
}

export function ColourStudio({ setCart, cartPanel, cartEmpty, openCheckout }) {
  // Until they're on sale (stickers.colour.available), people can design and
  // preview but not order.
  const available = cfg.available;
  const fileRef = useRef(null);
  const [image, setImage] = useState(null);
  const [fileName, setFileName] = useState("");
  // What happens to the image's background: "keep" it, clear a "plain"
  // colour (colour.js), or cut the subject out of a "photo" (cutout.js).
  const [bgMode, setBgMode] = useState("keep");
  // The last photo cut-out, and the image it was made from.
  const [cut, setCut] = useState(null);
  const [cutting, setCutting] = useState(false);
  // Words on the sticker (colour.js addText).
  const [texts, setTexts] = useState([]);
  const [fontsReady, setFontsReady] = useState(0); // bumps when a typeface arrives
  // The part of the upload to use ({ x, y, w, h } fractions; null = all of
  // it), and whether the crop dialog is open (it opens on every upload).
  const [crop, setCrop] = useState(null);
  const [cropping, setCropping] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [shape, setShape] = useState("contour");
  const [border, setBorder] = useState("medium");
  const [bg, setBg] = useState("#ffffff");
  const [width, setWidth] = useState(76);
  const [finishKey, setFinishKey] = useState(cfg.finishes[0].key);
  const [qty, setQty] = useState(10);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  // Turns background removal on for a design on a plain colour; a photo
  // keeps its background until the customer asks for the cut-out.
  function look(img) {
    const { transparent, plain } = inspect(img);
    setBgMode((m) => (m === "photo" && !transparent ? "photo" : !transparent && plain ? "plain" : "keep"));
  }

  function use(img, name) {
    look(img);
    setImage(img);
    setCrop(null);
    setFileName(name);
    setCropping(true);
  }

  function applyCrop(rect) {
    setCrop(rect);
    setCropping(false);
    // Cropping can leave a plain background where the whole image had a busy one.
    look(rect ? cropImage(image, rect) : image);
    // An outline around a design on a plain colour (Auto-crop's): clear the
    // bit of background left inside it, so the die-cut hugs the design.
    if (rect?.path && backdropColour(image)) setBgMode("plain");
  }

  useEffect(() => {
    loadImage("/stickers/colour-sample.png").then((img) => setImage((cur) => cur || img)).catch(() => {});
  }, []);

  function pick(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setError("");
    loadImage(URL.createObjectURL(file))
      .then((img) => use(img, file.name))
      .catch(() => setError("That image couldn't be opened. Try a PNG or JPG."));
  }

  const source = useMemo(() => (image && crop ? cropImage(image, crop) : image), [image, crop]);
  // Order of work: crop (above), then the background, then the text.
  useEffect(() => {
    if (bgMode !== "photo" || !source || cut?.source === source) return;
    let live = true;
    setCutting(true);
    setError("");
    removeBackground(source)
      .then((canvas) => live && setCut({ source, canvas }))
      .catch((err) => {
        console.warn("background removal:", err);
        if (!live) return;
        setError("The background remover couldn't load. Check your connection and try again.");
        setBgMode("keep");
      })
      .finally(() => live && setCutting(false));
    return () => {
      live = false;
      setCutting(false);
    };
  }, [bgMode, source]); // eslint-disable-line react-hooks/exhaustive-deps
  // Until the cut-out is ready the sticker shows the whole image.
  const base = bgMode === "photo" && cut?.source === source ? cut.canvas : source;
  const backdrop = useMemo(() => image && backdropColour(image), [image]);
  const cleaned = useMemo(
    () => (base ? prepareArt(base, { removeBackdrop: bgMode === "plain", backdrop }) : null),
    [base, bgMode, backdrop],
  );
  const art = useMemo(() => cleaned && addText(cleaned, texts), [cleaned, texts, fontsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw again once a typeface has downloaded.
  useEffect(() => {
    const fams = [...new Set(texts.map((t) => t.font))];
    if (!fams.length || !document.fonts) return;
    Promise.all(fams.map((f) => document.fonts.load(`${fontOf(f).weight} 40px "${f}"`)))
      .then(() => setFontsReady((n) => n + 1))
      .catch(() => {});
  }, [texts.map((t) => t.font).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const MAX_TEXTS = 3;
  function newText() {
    const font = FONTS[0];
    const where = ["below", "above", "over"][texts.length % 3];
    setTexts((ts) => [
      ...ts,
      { id: `t${Date.now()}`, text: "Your text", font: font.family, weight: font.weight, colour: "#111111", size: 0.16, where, outline: true },
    ]);
  }
  const patchText = (id, patch) => setTexts((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  // Where the image sits in the sticker (colour.js); starts afresh when the
  // image or the kind of shape changes.
  const kind = placeKind(shape);
  const [place, setPlace] = useState(PLACE_START.contour);
  useEffect(() => setPlace(PLACE_START[kind]), [kind, source]);
  const opts = useMemo(() => ({ shape, border, bg, place }), [shape, border, bg, place]);
  // Die-cut keeps only the zoomed-in part of the image, and cuts around that.
  const shown = useMemo(() => (art && kind === "contour" ? cropArt(art, place) : art), [art, kind, place]);
  const range = useMemo(
    () => art && widthRange(art, opts, colourFits, [cfg.minMm, Math.max(...cfg.maxMm)]),
    [art, opts],
  );
  // Keep the width inside what this design can be printed at.
  useEffect(() => {
    if (range) setWidth((w) => Math.min(range.max, Math.max(range.min, w)));
  }, [range]);
  const size = art ? layout(art, opts, width) : null;
  // The stage redraws a beat behind the slider, so dragging stays smooth.
  const stageWidth = useDeferredValue(width);
  const stageOpts = useDeferredValue(opts);
  const stageArt = useDeferredValue(shown);

  // Drag on the preview: die-cut moves the kept part the other way (the image
  // follows the finger); shapes move the image itself.
  function pan(dxMm, dyMm) {
    if (!size) return;
    setPlace((p) =>
      clampPlace(
        shape,
        kind === "contour"
          ? { ...p, x: p.x - dxMm / (size.art.w * p.zoom), y: p.y - dyMm / (size.art.h * p.zoom) }
          : { ...p, x: p.x + (2 * dxMm) / size.w, y: p.y + (2 * dyMm) / size.h },
      ),
    );
  }
  const zoomBy = (f) => setPlace((p) => clampPlace(shape, { ...p, zoom: p.zoom * f }));

  const each = size ? priceColourEach(size, qty) : 0;
  const total = each * qty;
  const nextBreak = cfg.pricing.breaks.find((b) => qty < b.qty);
  useEffect(() => setAdded(false), [shown, opts, width, qty, finishKey]);

  // Renders the print file, uploads it right away (so the cart stays small),
  // and puts the sticker in the cart.
  async function addToCart() {
    if (!art || !size) return null;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30)); // let the spinner show
    const { dataUrl } = printFile(shown, opts, width);
    const thumb = renderSticker(shown, opts, width, 240 / Math.max(size.w, size.h)).canvas.toDataURL("image/png");
    const w = Math.round(size.w * 10) / 10, h = Math.round(size.h * 10) / 10;
    const printUrl = await uploadArt(dataUrl, `colour-${Math.round(w)}x${Math.round(h)}mm`);
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: "colour",
      art: thumb,
      ...(printUrl ? { printUrl } : { print: dataUrl }),
      w,
      h,
      shape,
      finishKey,
      qty,
      fileName,
    };
    setCart((c) => [...c, item].slice(-20));
    setBusy(false);
    setAdded(true);
    return item;
  }

  const finish = cfg.finishes.find((f) => f.key === finishKey);

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
      <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <div className="relative">
          {art ? (
            <Stage art={stageArt} opts={stageOpts} width={stageWidth} onPan={pan} onZoom={zoomBy} />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-3xl bg-[#e9efe9] text-sm text-ink/50 ring-1 ring-ink/10 sm:aspect-[4/3]">
              {image ? "Nothing left to print: try another background option." : "Loading…"}
            </div>
          )}
          {cutting && (
            <p className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-ink/80 px-4 py-2 text-sm text-white backdrop-blur">
              <Loader2 size={15} className="animate-spin" /> Removing the background…
            </p>
          )}
          {size && (
            <p className="pointer-events-none absolute left-4 top-4 rounded-full bg-ink/75 px-3 py-1 font-mono text-xs text-white backdrop-blur">
              {Math.round(size.w)} × {Math.round(size.h)} mm · {inches(size.w)} × {inches(size.h)} in
            </p>
          )}
        </div>
        <p className="-mt-1 px-1 text-sm text-ink/60">
          Printed in full colour and cut to shape on the Cricut. The thin dark edge is the cut
          line; the grid is 1 cm.
        </p>
      </div>

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
              {fileName || "PNG with a see-through background cuts best. JPG works too."}
            </span>
          </span>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files[0])} />
        </div>
        {error && <p className="-mt-3 text-sm text-flame-600">{error}</p>}
        {STICKER_AI && (
          <div className="-mt-3">
            <AiSticker
              maker="colour"
              onImage={(file) => {
                // AI art comes on plain white: knock it out so the cut follows the design.
                setBgMode("plain");
                pick(file);
              }}
            />
          </div>
        )}
        {image && (
          <button type="button" onClick={() => setCropping(true)} className="btn-outline-dark -mt-3 h-10 self-start px-4 text-sm">
            <Crop size={14} /> {crop ? "Edit crop" : "Crop image"}
          </button>
        )}
        {cropping && image && (
          <CropDialog
            image={image}
            initial={crop}
            fresh={!crop}
            onApply={applyCrop}
            onClose={() => setCropping(false)}
          />
        )}

        <div>
          <Label hint={bgMode === "photo" ? "AI, on your device: your photo isn't uploaded" : null}>Background</Label>
          <div className="grid grid-cols-3 gap-2">
            <Choice active={bgMode === "keep"} onClick={() => setBgMode("keep")} sub="Use the whole image">
              Keep
            </Choice>
            <Choice active={bgMode === "plain"} onClick={() => setBgMode("plain")} sub="A logo on white">
              Plain colour
            </Choice>
            <Choice active={bgMode === "photo"} onClick={() => setBgMode("photo")} onPointerEnter={warmUp} sub="Pets, people, things">
              Photo
            </Choice>
          </div>
          {bgMode === "photo" && !cutting && cut?.source === source && (
            <p className="mt-2 text-xs text-ink/55">
              Missed a bit? Crop the image tighter around the subject, or switch to Keep to compare.
            </p>
          )}
        </div>

        <div>
          <Label hint={texts.length ? null : "optional"}>Text</Label>
          <div className="space-y-3">
            {texts.map((t) => (
              <div key={t.id} className="space-y-3 rounded-2xl bg-white p-3 ring-1 ring-ink/10">
                <div className="flex gap-2">
                  <textarea
                    value={t.text}
                    onChange={(e) => patchText(t.id, { text: e.target.value })}
                    rows={t.text.includes("\n") ? 2 : 1}
                    maxLength={60}
                    className="field resize-none text-base"
                    aria-label="Text"
                  />
                  <button
                    type="button"
                    onClick={() => setTexts((ts) => ts.filter((x) => x.id !== t.id))}
                    aria-label="Remove text"
                    className="flex-none rounded-xl px-3 text-ink/50 ring-1 ring-ink/15 hover:bg-flame hover:text-white"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {FONTS.map((f) => (
                    <button
                      key={f.family}
                      type="button"
                      onClick={() => patchText(t.id, { font: f.family, weight: f.weight })}
                      aria-pressed={t.font === f.family}
                      className={clsx(
                        "rounded-lg px-2.5 py-1 text-sm ring-1 transition",
                        t.font === f.family ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40",
                      )}
                      style={{ fontFamily: `"${f.family}"`, fontWeight: f.weight }}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Text colour">
                  {TEXT_COLOURS.map(([hex, name]) => (
                    <button
                      key={hex}
                      type="button"
                      role="radio"
                      aria-checked={t.colour === hex}
                      aria-label={name}
                      title={name}
                      onClick={() => patchText(t.id, { colour: hex })}
                      className={clsx(
                        "h-7 w-7 rounded-full ring-1 ring-ink/20 transition",
                        t.colour === hex && "ring-2 ring-flame ring-offset-2",
                      )}
                      style={{ background: hex }}
                    />
                  ))}
                  <label className="ml-auto flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={t.outline}
                      onChange={(e) => patchText(t.id, { outline: e.target.checked })}
                      className="accent-flame"
                    />
                    Outline
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink/5 p-1 text-sm font-semibold" role="radiogroup" aria-label="Where">
                    {[
                      ["above", "Above"],
                      ["over", "On"],
                      ["below", "Below"],
                    ].map(([k, name]) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={t.where === k}
                        onClick={() => patchText(t.id, { where: k })}
                        className={clsx("rounded-lg py-1.5 transition", t.where === k ? "bg-white shadow-sm ring-1 ring-ink/10" : "text-ink/55 hover:text-ink")}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <label className="block text-sm">
                    <span className="flex justify-between">
                      Size <span className="text-ink/50">{Math.round(t.size * 100)}</span>
                    </span>
                    <input
                      type="range"
                      min={0.06}
                      max={0.4}
                      step={0.01}
                      value={t.size}
                      onChange={(e) => patchText(t.id, { size: +e.target.value })}
                      className="mt-1 w-full accent-flame"
                    />
                  </label>
                </div>
              </div>
            ))}
            {texts.length < MAX_TEXTS && (
              <button type="button" onClick={newText} className="btn-outline-dark h-10 w-full text-sm">
                <Type size={15} /> {texts.length ? "Add more text" : "Add text"}
              </button>
            )}
          </div>
        </div>

        <div>
          <Label>Shape</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {COLOUR_SHAPES.map((s) => (
              <Choice key={s.key} active={shape === s.key} onClick={() => setShape(s.key)} sub={s.body}>
                {s.name}
              </Choice>
            ))}
          </div>
        </div>

        <div>
          <Label hint={shape === "contour" ? "white edge around your design" : "space around your design"}>Border</Label>
          <div className="grid grid-cols-3 gap-2">
            {BORDERS.map((b) => (
              <Choice key={b.key} active={border === b.key} onClick={() => setBorder(b.key)} sub={`${b.mm} mm`}>
                {b.name}
              </Choice>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm text-ink/60">Backing</span>
            {BACKINGS.map(([hex, name]) => (
              <button
                key={hex}
                type="button"
                onClick={() => setBg(hex)}
                aria-pressed={bg === hex}
                title={name}
                className={clsx(
                  "h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-paper transition",
                  bg === hex ? "ring-flame" : "ring-transparent hover:ring-ink/20",
                )}
                style={{ background: hex, boxShadow: "inset 0 0 0 1px rgb(12 26 46 / 0.15)" }}
              >
                <span className="sr-only">{name}</span>
              </button>
            ))}
            <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full ring-1 ring-ink/15" title="Any colour">
              <span className="absolute inset-0 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" />
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="absolute inset-0 opacity-0" aria-label="Any backing colour" />
            </label>
          </div>
        </div>

        {art && (
          <div>
            <Label hint={kind === "contour" ? "zoom in to crop" : "trimmed to the shape"}>Image position</Label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink/60">Zoom</span>
              <input
                type="range"
                min={Math.log(ZOOM[kind][0])}
                max={Math.log(ZOOM[kind][1])}
                step={0.01}
                value={Math.log(place.zoom)}
                onChange={(e) => setPlace((p) => clampPlace(shape, { ...p, zoom: Math.exp(+e.target.value) }))}
                className="min-w-0 flex-1 accent-flame"
                aria-label="Zoom"
              />
              <span className="w-12 text-right font-mono text-xs text-ink/50">{Math.round(place.zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setPlace(PLACE_START[kind])}
                className="btn-outline-dark h-9 px-3 text-sm"
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink/50">
              <Hand size={13} />
              {kind === "contour"
                ? place.zoom > 1
                  ? "Drag the preview to choose which part to keep. The cut follows it."
                  : "Zoom in to crop the image, then drag to choose which part to keep."
                : "Drag the preview to move the image; zoom or scroll to resize it."}
            </p>
          </div>
        )}

        {range && size && (
          <div>
            <Label hint={`up to ${Math.round(range.max)} mm wide`}>Size</Label>
            <input
              type="range"
              min={range.min}
              max={range.max}
              step={1}
              value={width}
              onChange={(e) => setWidth(+e.target.value)}
              className="w-full accent-flame"
              aria-label="Sticker width"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[50.8, 76.2, 101.6, 127].filter((w) => w >= range.min && w <= range.max).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWidth(w)}
                  className={clsx(
                    "rounded-lg px-3 py-1.5 text-sm ring-1 transition",
                    Math.abs(width - w) < 0.5 ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40",
                  )}
                >
                  {Math.round(w / 25.4)}″ wide
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label>Material</Label>
          <div className="grid grid-cols-2 gap-2">
            {cfg.finishes.map((f) => (
              <Choice key={f.key} active={finishKey === f.key} onClick={() => setFinishKey(f.key)} sub={f.body}>
                {f.name}
              </Choice>
            ))}
          </div>
        </div>

        {!available && (
          <div className="rounded-2xl bg-ink p-5 text-white">
            <p className="flex items-center gap-2 font-semibold">
              <span className="rounded-full bg-flame px-2 py-0.5 text-[10px] uppercase tracking-wider">Coming soon</span>
              Full-colour stickers aren't on sale yet
            </p>
            <p className="mt-2 text-sm text-white/65">
              Play with your design here in the meantime. Need some sooner? Send the image through a{" "}
              <a href="/#quote" className="font-semibold text-white underline underline-offset-2">free quote</a>
              {" "}and I'll let you know what I can do.
            </p>
          </div>
        )}

        {available && <div className="rounded-2xl bg-ink p-5 text-white">
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
              <p className="text-xs text-white/55">${each.toFixed(2)} each · CAD · {finish?.name.toLowerCase()}</p>
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
            disabled={added || busy || !art}
            className={clsx("btn mt-4 w-full", added ? "bg-white/10 text-white/70" : "bg-white text-ink hover:bg-paper")}
          >
            {busy ? (
              <><Loader2 size={18} className="animate-spin" /> Preparing the print file…</>
            ) : added ? (
              <><Check size={18} /> In your cart. Design another?</>
            ) : (
              <><Plus size={18} /> Add to cart</>
            )}
          </button>
        </div>}

        {cartPanel}
        {available && cartEmpty && (
          <button
            type="button"
            disabled={busy || !art}
            onClick={async () => {
              if (await addToCart()) openCheckout();
            }}
            className="btn-primary -mt-3 w-full"
          >
            <ShoppingBag size={18} /> Check out just this one
          </button>
        )}
      </div>
    </div>
  );
}
