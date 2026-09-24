import { Layers, Ruler, Clock, MapPin, ChevronDown } from "lucide-react";

// ---------------------------------------------------------------------------
// CONFIRM BEFORE LAUNCH: these are customer-facing claims. Build volume
// assumes a Bambu Lab X1C / P1S (256 mm cube), same as the old store page.
// ---------------------------------------------------------------------------
const SPECS = [
  { icon: Ruler, label: "Max part size", value: "256 × 256 × 256 mm" },
  { icon: Layers, label: "Layer height", value: "0.08 – 0.20 mm" },
  { icon: Clock, label: "Turnaround", value: "Most jobs 3–5 days" },
  { icon: MapPin, label: "Delivery", value: "Vancouver pickup or shipped" },
];

const MATERIALS = [
  { name: "PLA", best: "Display pieces, prototypes, indoor parts", strength: 2, heat: 1, flex: 1, finish: 3 },
  { name: "PETG", best: "Functional parts, outdoor use, anything near water", strength: 3, heat: 2, flex: 2, finish: 2 },
  { name: "Nylon", best: "Gears, hinges, high-wear mechanical parts", strength: 3, heat: 3, flex: 2, finish: 2 },
  { name: "TPU", best: "Gaskets, bumpers, grips, phone cases", strength: 2, heat: 2, flex: 3, finish: 1 },
];

function Meter({ value, label }) {
  return (
    <span className="flex gap-1" role="img" aria-label={`${label}: ${value} of 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`h-2 w-5 rounded-full ${i <= value ? "bg-flame" : "bg-ink/10"}`} />
      ))}
    </span>
  );
}

export function Materials() {
  return (
    <section id="materials" className="bg-paper-dark py-20 sm:py-28 layer-lines-dark">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <p className="eyebrow">Materials & specs</p>
            <h2 className="mt-3 text-4xl font-bold sm:text-5xl">The right plastic for the job.</h2>
            <p className="mt-4 text-ink/65">
              Not sure what you need? Tell me what the part has to do and I'll recommend one
              in your quote.
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-3">
              {SPECS.map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl bg-white/70 p-4">
                  <dt className="flex items-center gap-1.5 text-xs text-ink/50">
                    <Icon size={13} /> {label}
                  </dt>
                  <dd className="mt-1 font-display font-semibold leading-snug">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <details className="group self-start rounded-3xl bg-white ring-1 ring-ink/5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block font-display text-lg font-semibold">Compare materials</span>
                <span className="block text-sm text-ink/55">Strength, heat, flex and finish for each filament</span>
              </span>
              <ChevronDown size={20} className="shrink-0 text-ink/50 transition group-open:rotate-180" />
            </summary>
            <div className="overflow-x-auto border-t border-ink/10">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 font-mono text-[11px] uppercase tracking-widest text-ink/45">
                  <th className="px-6 py-4 font-medium">Material</th>
                  <th className="px-3 py-4 font-medium">Strength</th>
                  <th className="px-3 py-4 font-medium">Heat</th>
                  <th className="px-3 py-4 font-medium">Flex</th>
                  <th className="px-3 py-4 font-medium">Finish</th>
                </tr>
              </thead>
              <tbody>
                {MATERIALS.map((m) => (
                  <tr key={m.name} className="border-b border-ink/5 last:border-0 align-top">
                    <td className="px-6 py-5">
                      <p className="font-display text-lg font-semibold">{m.name}</p>
                      <p className="mt-0.5 text-ink/55">{m.best}</p>
                    </td>
                    <td className="px-3 py-6"><Meter value={m.strength} label="Strength" /></td>
                    <td className="px-3 py-6"><Meter value={m.heat} label="Heat resistance" /></td>
                    <td className="px-3 py-6"><Meter value={m.flex} label="Flexibility" /></td>
                    <td className="px-3 py-6"><Meter value={m.finish} label="Surface finish" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
