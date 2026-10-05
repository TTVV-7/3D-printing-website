import { Layers, Ruler, Clock, MapPin } from "lucide-react";

// ---------------------------------------------------------------------------
// CONFIRM BEFORE LAUNCH: these are customer-facing claims. Build volume
// assumes a Bambu Lab X1C / P1S (256 mm cube), same as the old store page.
// ---------------------------------------------------------------------------
const SPECS = [
  { icon: Ruler, label: "Max part size", value: "256 × 256 × 256 mm" },
  { icon: Layers, label: "Layer height", value: "0.12 – 0.28 mm" },
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

const METERS = [
  ["strength", "Strength", "Strength"],
  ["heat", "Heat", "Heat resistance"],
  ["flex", "Flex", "Flexibility"],
  ["finish", "Finish", "Surface finish"],
];

export function Materials() {
  return (
    <section id="materials" className="bg-paper-dark py-16 sm:py-28 layer-lines-dark">
      <div className="container-page">
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <p className="eyebrow">Materials & specs</p>
            <h2 className="mt-3 text-4xl font-bold sm:text-5xl">The right plastic for the job.</h2>
            <p className="mt-4 text-ink/65">
              Not sure what you need? Tell me what the part has to do and I'll recommend one
              in your quote.
            </p>

            <dl className="mt-6 flex flex-wrap gap-2 lg:mt-8 lg:grid lg:grid-cols-2 lg:gap-3">
              {SPECS.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-sm lg:block lg:rounded-2xl lg:p-4"
                >
                  <dt className="flex items-center gap-1.5 text-ink/50 lg:text-xs">
                    <Icon size={13} />
                    <span className="sr-only lg:not-sr-only">{label}</span>
                  </dt>
                  <dd className="font-medium leading-snug lg:mt-1 lg:font-display lg:font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Phones: one card per material, all four meters visible. */}
          <ul className="grid gap-3 sm:grid-cols-2 md:hidden">
            {MATERIALS.map((m) => (
              <li key={m.name} className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
                <p className="font-display text-lg font-semibold">{m.name}</p>
                <p className="mt-0.5 text-sm text-ink/55">{m.best}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                  {METERS.map(([key, label, long]) => (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <dt className="font-mono text-[11px] uppercase tracking-widest text-ink/45">{label}</dt>
                      <dd><Meter value={m[key]} label={long} /></dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-3xl bg-white ring-1 ring-ink/5 md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 font-mono text-[11px] uppercase tracking-widest text-ink/45">
                  <th className="px-6 py-4 font-medium">Material</th>
                  {METERS.map(([key, label]) => (
                    <th key={key} className="px-3 py-4 font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATERIALS.map((m) => (
                  <tr key={m.name} className="border-b border-ink/5 last:border-0 align-top">
                    <td className="px-6 py-5">
                      <p className="font-display text-lg font-semibold">{m.name}</p>
                      <p className="mt-0.5 text-ink/55">{m.best}</p>
                    </td>
                    {METERS.map(([key, , long]) => (
                      <td key={key} className="px-3 py-6"><Meter value={m[key]} label={long} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
