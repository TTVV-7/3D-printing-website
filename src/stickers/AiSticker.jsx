import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Check, ImageUp, Loader2, RefreshCw, Sparkles, WandSparkles } from "lucide-react";

// AI sticker art: describe a sticker, or turn a photo into one. The result is
// handed to the studio as if the customer had uploaded it (onImage), so the
// usual crop, shape and checkout steps all still apply.
//
// Only in the Cloudflare build (VITE_STICKER_AI=1, set by `npm run build:cf`),
// where /api/sticker-ai exists (cloudflare/sticker-ai.js). The Vercel build
// never shows it.
export const STICKER_AI = import.meta.env.VITE_STICKER_AI === "1";
const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const STYLES = [
  { key: "cartoon", label: "Cartoon" },
  { key: "cute", label: "Cute" },
  { key: "retro", label: "Retro" },
  { key: "watercolour", label: "Watercolour" },
  { key: "lineart", label: "Line art" },
];

const IDEAS = ["a grumpy cat drinking coffee", "a mountain bike jumping over a pine tree", "a smiling cactus in sunglasses"];

// The model only takes input images under 512 px a side.
function shrinkPhoto(file, max = 508) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    img.src = url;
  });
}

// Cloudflare Turnstile, only when a site key is configured.
function useTurnstile() {
  const box = useRef(null);
  const widget = useRef(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!TURNSTILE_KEY) return;
    const render = () => {
      if (!box.current || widget.current !== null || !window.turnstile) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_KEY,
        size: "flexible",
        callback: setToken,
        "expired-callback": () => setToken(""),
      });
    };
    if (window.turnstile) render();
    else if (!document.querySelector("script[data-turnstile]")) {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.dataset.turnstile = "1";
      s.onload = render;
      document.head.appendChild(s);
    } else {
      const t = setInterval(() => window.turnstile && (clearInterval(t), render()), 200);
      return () => clearInterval(t);
    }
  }, []);

  // Each token works once, so get a fresh one after every request.
  const reset = () => {
    setToken("");
    if (widget.current !== null) window.turnstile?.reset(widget.current);
  };
  return { box, token, reset, needed: Boolean(TURNSTILE_KEY) };
}

export function AiSticker({ maker, onImage }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("cartoon");
  const [photo, setPhoto] = useState(null); // { name, dataUrl }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [left, setLeft] = useState(null);
  const photoRef = useRef(null);
  const turnstile = useTurnstile();
  const thermal = maker === "thermal";

  if (!STICKER_AI) return null;

  async function choosePhoto(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setError("");
    try {
      setPhoto({ name: file.name, dataUrl: await shrinkPhoto(file) });
    } catch {
      setError("That photo couldn't be opened. Try a JPG or PNG.");
    }
  }

  async function generate() {
    setError("");
    setResult(null);
    if (mode === "create" && prompt.trim().length < 3) return setError("Describe your sticker in a few words.");
    if (mode === "stickerize" && !photo) return setError("Choose a photo first.");
    if (turnstile.needed && !turnstile.token) return setError("One moment, checking you're not a bot…");
    setBusy(true);
    try {
      const res = await fetch("/api/sticker-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          maker,
          style,
          prompt: mode === "create" ? prompt : undefined,
          image: mode === "stickerize" ? photo.dataUrl : undefined,
          turnstile: turnstile.token || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.left === "number") setLeft(data.left);
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      setResult(data.image);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      turnstile.reset();
    }
  }

  async function useResult() {
    const blob = await (await fetch(result)).blob();
    const ext = blob.type.split("/")[1] || "png";
    onImage(new File([blob], `ai-sticker.${ext}`, { type: blob.type }));
    setResult(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-4 rounded-2xl bg-ink p-4 text-left text-white transition hover:bg-ink/90"
      >
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-flame text-white">
          <Sparkles size={20} />
        </span>
        <span className="min-w-0 text-sm">
          <span className="block font-semibold">No image? Make one with AI</span>
          <span className="block text-white/60">Describe a sticker, or turn a photo into one.</span>
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/10">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={16} className="text-flame" /> AI sticker maker
        </p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink/50 hover:text-ink">
          Close
        </button>
      </div>

      <div role="tablist" className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-paper p-1 text-sm">
        {[
          { key: "create", label: "Describe it", icon: WandSparkles },
          { key: "stickerize", label: "From a photo", icon: ImageUp },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => {
              setMode(key);
              setError("");
              setResult(null);
            }}
            className={clsx(
              "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 font-medium transition",
              mode === key ? "bg-white shadow-sm" : "text-ink/60 hover:text-ink",
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {mode === "create" ? (
        <div className="mt-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 200))}
            rows={2}
            maxLength={200}
            placeholder={`e.g. ${IDEAS[0]}`}
            className="field resize-none text-base"
            aria-label="Describe your sticker"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setPrompt(idea)}
                className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink/70 hover:bg-flame/10 hover:text-ink"
              >
                {idea}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-ink/20 p-3 text-left text-sm hover:border-ink/40"
          >
            {photo ? (
              <img src={photo.dataUrl} alt="" className="h-14 w-14 flex-none rounded-lg object-cover" />
            ) : (
              <span className="flex h-14 w-14 flex-none items-center justify-center rounded-lg bg-flame/10 text-flame">
                <ImageUp size={20} />
              </span>
            )}
            <span className="min-w-0">
              <span className="block font-semibold">{photo ? "Change photo" : "Choose a photo"}</span>
              <span className="block truncate text-ink/55">{photo?.name || "A pet, a car, a face: one clear subject works best."}</span>
            </span>
          </button>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              choosePhoto(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {thermal ? (
        <p className="mt-3 text-xs text-ink/55">Thermal stickers print in black, so the AI draws bold line art.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Style">
          {STYLES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStyle(s.key)}
              aria-pressed={style === s.key}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-sm ring-1 transition",
                style === s.key ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {turnstile.needed && <div ref={turnstile.box} className="mt-3" />}

      {result ? (
        <div className="mt-4">
          <img src={result} alt="AI-generated sticker design" className="mx-auto aspect-square w-full max-w-xs rounded-xl bg-paper object-contain" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={generate} disabled={busy || left === 0} className="btn-outline-dark h-11 text-sm disabled:opacity-40">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Try again
            </button>
            <button type="button" onClick={useResult} className="btn-primary h-11 text-sm">
              <Check size={16} /> Use this
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={generate} disabled={busy || left === 0} className="btn-primary mt-4 h-11 w-full text-sm disabled:opacity-50">
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Drawing your sticker…
            </>
          ) : (
            <>
              <Sparkles size={16} /> {mode === "create" ? "Make my sticker" : "Stickerize my photo"}
            </>
          )}
        </button>
      )}

      {error && <p className="mt-2 text-sm text-flame-600">{error}</p>}
      <p className="mt-2 text-xs text-ink/45">
        {left !== null ? `${left} free design${left === 1 ? "" : "s"} left today. ` : "A few free designs a day. "}
        Original ideas only: no logos, brands or characters. Every order is checked before printing.
      </p>
    </div>
  );
}
