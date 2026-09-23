const STEPS = [
  {
    title: "Send your idea",
    body: "A link, an STL, a photo of the broken part, or just a description. If you don't have a model, I can design one.",
  },
  {
    title: "Get a fixed quote",
    body: "Within one business day: a price, the material I'd recommend, and a realistic turnaround. No surprises.",
  },
  {
    title: "Printed & checked",
    body: "You approve, I print. Every part is cleaned up and checked before it goes out, and reprinted free if something's off.",
  },
];

export function Process() {
  return (
    <section className="bg-ink py-20 text-white sm:py-28 layer-lines">
      <div className="container-page">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-bold sm:text-5xl">Three steps. No account needed.</h2>

        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative border-t border-white/15 pt-6">
              <span className="absolute -top-px left-0 h-px w-16 bg-flame" aria-hidden />
              <span className="font-mono text-sm text-flame">0{i + 1}</span>
              <h3 className="mt-3 text-2xl font-semibold">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-white/65">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
