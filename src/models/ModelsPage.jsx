import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Box, Loader2, Play, RotateCcw, X } from "lucide-react";
import { clsx } from "clsx";
import { track } from "@vercel/analytics";
import { models, MODELS_REPO } from "./catalog.js";
import { ShortPlayer } from "../components/ShortPlayer.jsx";

// The /models page: models from the Weave-Trial repo marked `show: true` in
// catalog.js, each with a picture, a 3D view (ModelScene.js) and a button
// that turns it into a quote request. Opening a model moves the address to
// /models/<id>/, its own page (scripts/model-pages.js), so it can be shared
// and found in search; landing on that address opens the model.

const SHOWN = models.filter((m) => m.show);
const pathOf = (m) => (m ? `/models/${m.id}/` : "/models/");
const fromPath = () => SHOWN.find((m) => location.pathname.replace(/\/+$/, "") === `/models/${m.id}`) || null;
const extOf = (p) => p.slice(p.lastIndexOf(".") + 1).toLowerCase();

// On Cloudflare the Worker serves (and keeps) the files; elsewhere they come
// straight from GitHub.
const fileUrl = (p) =>
  p.startsWith("/")
    ? p
    : import.meta.env.VITE_MODELS_API === "1"
    ? `/api/model-file?p=${encodeURIComponent(p)}`
    : `https://raw.githubusercontent.com/${MODELS_REPO}/HEAD/${p.split("/").map(encodeURIComponent).join("/")}`;

// Fills in the quote form with the model and takes them there.
function requestPrint(m, sizeMm) {
  track("Get this printed", { model: m.id });
  const details = `I'd like this printed: ${m.name} (${m.collection}) from the 3D models page${sizeMm ? `, about ${sizeMm.join(" × ")} mm` : ""}. How many / any changes: `;
  try {
    sessionStorage.setItem("quote-prefill", JSON.stringify({ details }));
  } catch {
    // No storage: the quote form opens empty.
  }
  location.href = "/#quote";
}

function Viewer({ model, onClose }) {
  const canvasRef = useRef(null);
  const [state, setState] = useState({ loading: true });
  const [watching, setWatching] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    let stage, cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("./ModelScene.js")
      .then(({ mountModel }) => mountModel(canvasRef.current, { url: fileUrl(model.file), ext: extOf(model.file), reducedMotion }))
      .then((s) => {
        if (cancelled) return s.dispose();
        stage = s;
        setState({ sizeMm: s.sizeMm });
      })
      .catch((err) => {
        console.warn("3D view:", err);
        if (!cancelled) setState({ error: true });
      });
    const onKey = (e) => e.key === "Escape" && !document.querySelector("[data-short-player]") && close.current();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      stage?.dispose();
      window.removeEventListener("keydown", onKey);
    };
  }, [model]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={model.name}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-3xl"
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-full bg-white/80 p-2 hover:bg-white">
          <X size={18} />
        </button>
        <div className="relative aspect-[4/3] bg-gradient-to-b from-[#eef2ee] to-[#dfe6df]">
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing" />
          {state.loading && (
            <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-ink/60">
              <Loader2 size={16} className="animate-spin" /> Loading the model ({model.mb} MB)…
            </p>
          )}
          {state.error && (
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-ink/60">
              This one couldn't be shown in 3D. Ask about it in a free quote and I'll send pictures.
            </p>
          )}
          {!state.loading && !state.error && (
            <p className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1 text-xs text-white">
              <RotateCcw size={12} /> Drag to turn, scroll or pinch to zoom
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-flame">{model.collection}</p>
            <p className="text-lg font-semibold">{model.name}</p>
            {state.sizeMm && <p className="text-sm text-ink/55">About {state.sizeMm.join(" × ")} mm</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {model.video && (
              <button type="button" onClick={() => setWatching(true)} className="btn-outline-dark">
                <Play size={16} fill="currentColor" /> Watch it print
              </button>
            )}
            <button type="button" onClick={() => requestPrint(model, state.sizeMm)} className="btn-primary">
              Get this printed <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
      {watching && <ShortPlayer id={model.video.id} title={model.name} onClose={() => setWatching(false)} />}
    </div>
  );
}

export function ModelsPage() {
  const collections = useMemo(() => [...new Set(SHOWN.map((m) => m.collection))], []);
  const [filter, setFilter] = useState("All");
  // Opened after the first render, so the page matches its prerendered HTML.
  const [open, setOpenState] = useState(null);
  const list = filter === "All" ? SHOWN : SHOWN.filter((m) => m.collection === filter);

  // Keep the address in step with the open model, and follow back/forward.
  function setOpen(m) {
    setOpenState(m);
    if (m) track("Model opened", { model: m.id });
    if (location.pathname !== pathOf(m)) history.pushState(null, "", pathOf(m));
  }
  useEffect(() => {
    setOpenState(fromPath());
    const onPop = () => setOpenState(fromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <>
      <section className="bg-ink pb-14 pt-28 text-white sm:pb-16 sm:pt-32">
        <div className="container-page">
          <p className="eyebrow text-flame">3D models</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold sm:text-6xl">Things I've designed.</h1>
          <p className="mt-5 max-w-2xl text-white/70 sm:text-lg">
            Original models, made here in Vancouver. Turn them around in 3D, then have one printed in the colours and
            material you like.
          </p>
        </div>
      </section>

      <section className="bg-paper py-12 sm:py-16">
        <div className="container-page">
          {collections.length > 1 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Collections">
              {["All", ...collections].map((c) => (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={filter === c}
                  onClick={() => setFilter(c)}
                  className={clsx(
                    "rounded-full px-4 py-1.5 text-sm font-medium ring-1 transition",
                    filter === c ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {list.length ? (
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((m) => (
                <li key={m.id}>
                  <a
                    href={pathOf(m)}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
                      e.preventDefault();
                      setOpen(m);
                    }}
                    className="group flex h-full w-full flex-col overflow-hidden rounded-3xl bg-white text-left ring-1 ring-ink/10 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-ink/5"
                  >
                    <span className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-b from-[#eef2ee] to-[#dfe6df] p-4">
                      {m.preview ? (
                        <img src={fileUrl(m.preview)} alt="" loading="lazy" className="max-h-full max-w-full object-contain transition duration-500 group-hover:scale-105" />
                      ) : (
                        <Box size={48} className="text-ink/25" />
                      )}
                      {m.video && (
                        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-medium text-white">
                          <Play size={10} fill="currentColor" /> Video
                        </span>
                      )}
                    </span>
                    <span className="flex flex-1 items-end justify-between gap-3 p-5">
                      <span>
                        <span className="block text-xs font-medium uppercase tracking-wider text-flame">{m.collection}</span>
                        <span className="block text-lg font-semibold">{m.name}</span>
                      </span>
                      <span className="flex-none text-sm font-semibold text-ink/60 group-hover:text-flame">View in 3D</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-ink/60">New models coming soon.</p>
          )}

          <p className="mt-10 max-w-2xl text-sm text-ink/60">
            Want something like these, but your own? I design custom parts and gifts from a photo, a sketch or a few
            measurements.{" "}
            <a href="/#quote" className="font-medium text-ink underline decoration-flame underline-offset-4 hover:text-flame">
              Get a free quote
            </a>
            .
          </p>
        </div>
      </section>

      {open && <Viewer model={open} onClose={() => setOpen(null)} />}
    </>
  );
}
