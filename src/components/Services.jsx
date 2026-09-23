import { Wrench, FlaskConical, Boxes, PenTool, Mountain } from "lucide-react";

const SERVICES = [
  {
    icon: Wrench,
    title: "Replacement parts",
    body: "Broken appliance clips, shelf brackets, knobs, covers and hard-to-find bits. Often cheaper and faster than tracking down the original.",
    tags: ["Appliances", "Furniture", "Cars & bikes"],
  },
  {
    icon: FlaskConical,
    title: "Prototypes",
    body: "Hold your idea in your hand before you commit to tooling. Iterate quickly on fit, size and feel, one revision at a time.",
    tags: ["Product design", "Enclosures", "Fit checks"],
  },
  {
    icon: Boxes,
    title: "Small batches",
    body: "A handful to a few hundred identical parts, printed consistently. Good for small businesses, makers and short runs.",
    tags: ["Jigs & fixtures", "Merch", "Spares"],
  },
  {
    icon: PenTool,
    title: "Custom design",
    body: "No model? Send photos, measurements or a sketch and I'll model it in CAD, then print it. Design time is quoted up front.",
    tags: ["From photos", "From sketches", "Modifications"],
  },
];

export function Services() {
  return (
    <section id="services" className="py-20 sm:py-28">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="eyebrow">What I print</p>
          <h2 className="mt-3 text-4xl font-bold sm:text-5xl">From one-off fixes to short runs.</h2>
          <p className="mt-4 text-lg text-ink/65">
            If it fits in a 25 cm cube and can be made from plastic, it's probably printable.
            Not sure? Ask. Quotes are free.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {SERVICES.map(({ icon: Icon, title, body, tags }) => (
            <article
              key={title}
              className="group relative rounded-3xl bg-white p-7 ring-1 ring-ink/5 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-ink/5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-flame-100 text-flame transition group-hover:bg-flame group-hover:text-white">
                <Icon size={22} />
              </div>
              <h3 className="mt-5 text-2xl font-semibold">{title}</h3>
              <p className="mt-2 leading-relaxed text-ink/65">{body}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <li key={t} className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink/60">
                    {t}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <a
          href="#work"
          className="mt-4 flex flex-col gap-4 rounded-3xl bg-ink p-7 text-white sm:flex-row sm:items-center sm:justify-between layer-lines"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-white/10 text-sky">
              <Mountain size={22} />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Topographic maps & city models</h3>
              <p className="text-white/65">Where it all started: custom relief maps of the places that matter to you.</p>
            </div>
          </div>
          <span className="text-sm font-medium text-flame whitespace-nowrap">See examples →</span>
        </a>
      </div>
    </section>
  );
}
