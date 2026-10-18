import { useEffect, useRef, useState } from "react";

// The crystal golem, perched on the quote form's send button. He perks up when
// the button is hovered and jumps when it's pressed. Loads only once the form
// is near the screen, and quietly stays away if the browser can't do WebGL.
export function QuoteGolem() {
  const wrapRef = useRef(null);
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

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        load();
      },
      { rootMargin: "300px" },
    );
    io.observe(wrapRef.current);

    // The button he sits on is his sibling.
    const button = wrapRef.current.parentElement.querySelector("button[type=submit]");
    const excite = () => sceneRef.current?.excite();
    const hop = () => sceneRef.current?.hop();
    button?.addEventListener("pointerenter", excite);
    button?.addEventListener("click", hop);

    // Lean gently toward the pointer.
    const onMove = (e) =>
      sceneRef.current?.lean(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      cancelled = true;
      io.disconnect();
      button?.removeEventListener("pointerenter", excite);
      button?.removeEventListener("click", hop);
      window.removeEventListener("pointermove", onMove);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div ref={wrapRef} className="pointer-events-none absolute -top-9 right-3 z-10 h-24 w-20 sm:right-5">
      <button
        type="button"
        tabIndex={-1}
        onClick={() => sceneRef.current?.hop()}
        onPointerEnter={() => sceneRef.current?.excite()}
        aria-hidden
        title="Hi!"
        className={`relative h-full w-full transition-opacity duration-700 ${
          ready ? "pointer-events-auto opacity-100" : "opacity-0"
        }`}
      >
        <canvas ref={canvasRef} className="h-full w-full" />
      </button>
    </div>
  );
}
