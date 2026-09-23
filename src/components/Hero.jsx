import { ArrowRight, Check } from "lucide-react";

const POINTS = ["Free quote in 1 business day", "Local pickup in Vancouver", "No model? I can design it"];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-ink text-white layer-lines">
      {/* Nozzle-glow accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-flame/25 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 bottom-0 h-96 w-96 rounded-full bg-sky/20 blur-[120px]"
      />

      <div className="container-page relative grid items-center gap-12 pt-28 pb-20 sm:pt-32 lg:grid-cols-[1.15fr_1fr] lg:pb-28">
        <div>
          <p className="eyebrow">3D printing service · Vancouver, BC</p>
          <h1 className="mt-5 text-[2.75rem] leading-[1.02] font-bold sm:text-6xl lg:text-7xl">
            Parts that fit.
            <br />
            Prototypes that <span className="text-flame">ship.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            Broken clip, missing knob, a first prototype or fifty of the same part. Send a
            file, a link or just a photo and I'll quote it, print it and check it before it
            goes out.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#quote" className="btn-primary">
              Get a free quote <ArrowRight size={18} />
            </a>
            <a href="#work" className="btn-outline-light">
              See recent work
            </a>
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <Check size={16} className="text-flame" /> {p}
              </li>
            ))}
          </ul>
        </div>

        <figure className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] ring-1 ring-white/15 shadow-2xl shadow-black/40 rotate-[1.5deg]">
            <img
              src="/work/downtown-vancouver.webp"
              alt="A multi-colour 3D-printed model of downtown Vancouver's skyline"
              className="h-full w-full object-cover"
              fetchpriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
          </div>
          <figcaption className="absolute -bottom-5 -left-3 sm:-left-6 rounded-2xl bg-white px-4 py-3 text-ink shadow-xl">
            <p className="font-mono text-[11px] uppercase tracking-widest text-ink/50">Printed here</p>
            <p className="font-display font-semibold">Downtown Vancouver city model</p>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
