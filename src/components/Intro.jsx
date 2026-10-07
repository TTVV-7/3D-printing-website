import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { clsx } from "clsx";

// Full-screen opening: contour lines of the North Shore Mountains
// (TopoScene.js) behind the business name. Scrolling down leads into the Hero.
export function Intro() {
  const canvasRef = useRef(null);
  const layerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let scene;
    let cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Set the layer readout directly so scrolling doesn't re-render React.
    const onLayer = (m) => {
      if (layerRef.current) layerRef.current.textContent = `${m} m`;
    };
    import("./TopoScene.js")
      .then(({ mountTopo }) => (cancelled ? null : mountTopo(canvasRef.current, { reducedMotion, onLayer })))
      .then((s) => {
        if (!s) return;
        if (cancelled) return s.dispose();
        scene = s;
        setReady(true);
      })
      .catch((err) => console.warn("Intro background skipped:", err));
    return () => {
      cancelled = true;
      scene?.dispose();
    };
  }, []);

  return (
    <section id="top" className="relative flex min-h-[100svh] items-center overflow-hidden bg-ink text-white">
      <canvas
        ref={canvasRef}
        aria-hidden
        className={clsx("absolute inset-0 h-full w-full transition-opacity duration-1000", ready ? "opacity-100" : "opacity-0")}
      />
      {/* Keeps the text readable over the lines. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(12,26,46,0.85)_0%,rgba(12,26,46,0.4)_45%,transparent_75%)]"
      />

      <div className="container-page relative py-28">
        <p className="eyebrow">Print Yours · Vancouver, BC</p>
        <h1 className="mt-5 max-w-4xl text-4xl leading-[1.05] font-bold sm:text-5xl lg:text-6xl">
          Custom 3D printing in <span className="text-flame">Vancouver.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed sm:text-lg text-white/70">
          Replacement parts, prototypes and small batches, printed layer by layer and checked
          before they go out.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#quote" className="btn-primary">
            Get a free quote <ArrowRight size={18} />
          </a>
          <a href="#start" className="btn-outline-light">
            See what I do
          </a>
        </div>
      </div>

      <p
        aria-hidden
        className={clsx(
          "absolute bottom-6 right-4 hidden text-right font-mono text-[11px] uppercase leading-relaxed tracking-widest text-white/40 transition-opacity duration-1000 sm:right-8 sm:block",
          ready ? "opacity-100" : "opacity-0",
        )}
      >
        North Shore Mountains · 49.37°N 123.08°W
        <br />
        Printing layer <span ref={layerRef} className="text-flame" />
      </p>

      <a
        href="#start"
        aria-label="Scroll down"
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-white/50 hover:text-white"
      >
        Scroll
        <ChevronDown size={20} className="animate-bounce motion-reduce:animate-none" />
      </a>
    </section>
  );
}
