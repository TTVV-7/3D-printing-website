import { useEffect, useRef, useState } from "react";

// A small crystal golem that floats in the corner, just for flair. It loads
// after everything else, never blocks the page, and quietly disappears if the
// browser can't do WebGL.
export function FloatingGolem() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    async function load() {
      try {
        const { mountGolem } = await import("./GolemScene.js");
        if (cancelled || !canvasRef.current) return;
        const golem = await mountGolem(canvasRef.current, { reducedMotion });
        if (cancelled) return golem.dispose();
        sceneRef.current = golem;
        setReady(true);
      } catch (err) {
        console.warn("Golem skipped:", err);
      }
    }

    // Wait until the page has loaded and the browser is idle.
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    const kick = () => idle(load);
    if (document.readyState === "complete") kick();
    else window.addEventListener("load", kick, { once: true });

    // Lean gently toward the pointer.
    const onMove = (e) =>
      sceneRef.current?.lean(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", kick);
      window.removeEventListener("pointermove", onMove);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => sceneRef.current?.hop()}
      onPointerEnter={() => sceneRef.current?.excite()}
      aria-label="Crystal golem mascot. Click to make it jump."
      title="Hi!"
      className={`fixed bottom-4 right-3 z-40 hidden h-32 w-28 sm:block transition-opacity duration-700 ${
        ready ? "opacity-100" : "pointer-events-none opacity-0"
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame rounded-2xl`}
    >
      {/* Soft glow the golem hovers over. */}
      <span
        aria-hidden
        className="absolute bottom-1 left-1/2 h-3 w-16 -translate-x-1/2 rounded-full bg-flame/40 blur-md"
      />
      <canvas ref={canvasRef} className="relative h-full w-full" />
    </button>
  );
}
