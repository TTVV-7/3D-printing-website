import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Hand, Smartphone } from "lucide-react";
import { clsx } from "clsx";
import { site } from "../../site.config.js";

// Each of these is a shape in the generator app (3D-print-sandbox repo). The
// models are that app's own output for the sample text; rebuild them with
// `node scripts/designer-models.mjs`. The photo stands in until the 3D stage
// is ready, and for good if the browser can't do WebGL.
const GENERATORS = [
  {
    key: "fob",
    title: "NFC business fob",
    body: "Your details on the front and an NFC tag sealed inside. Tap a phone to it and it opens your link.",
    image: "/designer/nfc_fob.webp",
    alt: "Black keyring fob printed with a name, company and phone number",
    model: "/models/designer/fob.glb",
  },
  {
    key: "name",
    title: "Name keyring",
    body: "The name itself as the keyring, in any of 48 typefaces from clean to comic to blackletter.",
    image: "/designer/keyring.webp",
    alt: "Green and white 3D-printed name keyring spelling Freddie",
    model: "/models/designer/name.glb",
  },
  {
    key: "sign",
    title: "Light-up sign",
    body: "A slim light box with your word or logo lit through the face. Good for shopfronts and desks.",
    image: "/designer/sign.webp",
    alt: "Dark sign enclosure with the word OPEN lit through its face",
    model: "/models/designer/sign.glb",
  },
  {
    key: "stencil",
    title: "Stencil",
    body: "A word or an SVG cut clean through a plate, with every island bridged so letter centres stay put.",
    image: "/designer/stencil.webp",
    alt: "Red plastic stencil plate with the word SHOP cut through it",
    model: "/models/designer/stencil.glb",
  },
  {
    key: "pet",
    title: "Pet tag",
    body: "A bone-shaped collar tag with your pet's name on the front and your number on the back.",
    image: "/designer/pet.webp",
    alt: "Orange bone-shaped pet tag with the name Biscuit in dark letters",
    model: "/models/designer/pet.glb",
  },
];

// Switches the quote form at the bottom of the page into "design" mode
// (see Quote.jsx) and lets the link scroll there.
const sendDesign = () => window.dispatchEvent(new Event("quote:design"));

const STEPS = [
  { title: "Design it", body: "Open the designer, type your text, pick a shape and colours." },
  { title: "Download the file", body: "Export the STL or 3MF when the preview looks right." },
  { title: "Send it to me", body: "Attach the file to a quote request and I'll reply with a fixed price." },
];

function useStage(canvasRef, sectionRef) {
  const stage = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    async function load() {
      try {
        const { mountDesigner } = await import("./DesignerScene.js");
        if (cancelled || !canvasRef.current) return;
        const s = await mountDesigner(canvasRef.current, { reducedMotion });
        if (cancelled) return s.dispose();
        stage.current = s;
        setReady(true);
      } catch (err) {
        console.warn("3D preview skipped:", err);
      }
    }

    // Fetch three.js only once the section is about to scroll into view.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        load();
      },
      { rootMargin: "400px" },
    );
    io.observe(sectionRef.current);

    return () => {
      cancelled = true;
      io.disconnect();
      stage.current?.dispose();
      stage.current = null;
    };
  }, [canvasRef, sectionRef]);

  return { stage, ready };
}

export function Designer() {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const { stage, ready } = useStage(canvasRef, sectionRef);
  const [active, setActive] = useState(GENERATORS[0].key);
  const [shown, setShown] = useState(null); // the model on the stage right now
  const current = GENERATORS.find((g) => g.key === active);

  useEffect(() => {
    if (!ready) return;
    let stale = false;
    stage.current
      .show(current.model)
      .then(() => !stale && setShown(current.key))
      .catch((err) => console.warn("Model failed to load:", err));
    return () => {
      stale = true;
    };
  }, [ready, current, stage]);

  const live = ready && shown === active;

  return (
    <section
      ref={sectionRef}
      id="design"
      className="relative overflow-hidden bg-ink py-16 text-white sm:py-24 layer-lines"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-flame/15 blur-[120px]"
      />
      <div className="container-page relative">
        <div className="max-w-2xl">
          <p className="eyebrow">Design your own</p>
          <h2 className="mt-3 text-4xl font-bold sm:text-5xl">Make it yours in the browser.</h2>
          <p className="mt-4 text-white/65 sm:text-lg">
            Type your name, pick a style and watch the 3D model rebuild live. Send it over and
            I'll print it.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:gap-10">
          {/* The stage */}
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-[radial-gradient(ellipse_at_center,_#1d3a5c_0%,_#0c1a2e_75%)] ring-1 ring-white/10 sm:aspect-[4/3]">
            <img
              src={current.image}
              alt={current.alt}
              className={clsx(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
                live ? "opacity-0" : "opacity-100",
              )}
            />
            <canvas
              ref={canvasRef}
              aria-label={`3D model of a ${current.title.toLowerCase()}. Drag to turn it.`}
              role="img"
              className={clsx(
                "absolute inset-0 h-full w-full cursor-grab touch-pan-y transition-opacity duration-500 active:cursor-grabbing",
                live ? "opacity-100" : "opacity-0",
              )}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-ink/80 to-transparent p-5">
              <p className="font-display text-lg font-semibold">{current.title}</p>
              {live && (
                <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-white/55">
                  <Hand size={14} /> Drag to spin
                </p>
              )}
            </div>
          </div>

          {/* The picker */}
          <div className="flex min-w-0 flex-col">
            <ul
              className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
              aria-label="Choose a design"
            >
              {GENERATORS.map((g) => (
                <li key={g.key} className="flex-none snap-start lg:flex-auto">
                  <button
                    type="button"
                    onClick={() => setActive(g.key)}
                    aria-pressed={active === g.key}
                    className={clsx(
                      "flex w-full items-center gap-3 rounded-2xl p-2 pr-4 text-left ring-1 transition",
                      active === g.key
                        ? "bg-white/10 ring-flame"
                        : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.08]",
                    )}
                  >
                    <img
                      src={g.image}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 flex-none rounded-xl object-cover lg:h-14 lg:w-14"
                    />
                    <span className="min-w-0">
                      <span className="block whitespace-nowrap font-display font-semibold">{g.title}</span>
                      <span className="hidden text-sm leading-snug text-white/55 lg:block">{g.body}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-sm leading-relaxed text-white/65 lg:hidden">{current.body}</p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row lg:mt-6 lg:flex-col xl:flex-row [&>a]:whitespace-nowrap">
              <a href={site.designerUrl} target="_blank" rel="noopener" className="btn-primary">
                Customize yours <ArrowUpRight size={18} />
              </a>
              <a
                href={`${site.designerUrl}/case`}
                target="_blank"
                rel="noopener"
                className="btn-outline-light"
              >
                <Smartphone size={18} /> Custom phone case
              </a>
            </div>

            <p className="mt-5 text-sm text-white/50">
              Have a design ready?{" "}
              <a href="#quote" onClick={sendDesign} className="text-flame underline-offset-4 hover:underline">
                Send it here
              </a>{" "}
              and I'll quote it.
            </p>
          </div>
        </div>

        <div
          id="design-quote"
          className="mt-14 scroll-mt-24 rounded-[2rem] bg-white/[0.03] p-5 ring-1 ring-white/10 sm:p-10"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="eyebrow">Send your design</p>
              <h3 className="mt-3 text-3xl font-bold sm:text-4xl">Made something? Get it printed.</h3>
              <p className="mt-4 text-white/65">
                Send the file from the designer with a quote request and you'll get a fixed price
                within one business day.
              </p>
            </div>
            <a href="#quote" onClick={sendDesign} className="btn-primary self-start lg:self-auto">
              Send my design <ArrowRight size={18} />
            </a>
          </div>
          <ol className="mt-8 grid gap-5 sm:grid-cols-3">
            {STEPS.map(({ title, body }, i) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-flame/15 font-mono text-sm text-flame ring-1 ring-flame/40">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-0.5 text-sm text-white/55">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
