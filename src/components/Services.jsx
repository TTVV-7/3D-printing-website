import { Printer, PenTool, Boxes, Check, Mountain } from "lucide-react";
import { clsx } from "clsx";
import { pricing } from "../../site.config.js";

const ICONS = { print: Printer, design: PenTool, batch: Boxes };

export function Services() {
  return (
    <section id="services" className="pt-16 pb-4 sm:pt-24 sm:pb-8">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="eyebrow">Services & pricing</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Clear prices, fixed before printing.</h2>
          <p className="mt-4 text-ink/65 sm:text-lg">
            Every job gets an exact quote within one business day. Nothing is printed until you
            approve it. All prices in CAD.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {pricing.services.map(({ key, title, price, unit, body, includes, featured }) => {
            const Icon = ICONS[key];
            return (
              <article
                key={key}
                className={clsx(
                  "flex flex-col rounded-3xl p-5 ring-1 sm:p-7",
                  featured ? "bg-ink text-white ring-ink layer-lines" : "bg-white ring-ink/5",
                )}
              >
                <div
                  className={clsx(
                    "flex h-12 w-12 items-center justify-center rounded-2xl",
                    featured ? "bg-flame text-white" : "bg-flame-100 text-flame",
                  )}
                >
                  <Icon size={22} />
                </div>
                <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                <p className="mt-3">
                  <span className="font-display text-3xl font-bold">{price}</span>
                  <span className={clsx("ml-2 text-sm", featured ? "text-white/55" : "text-ink/50")}>{unit}</span>
                </p>
                <p className={clsx("mt-3 leading-relaxed", featured ? "text-white/70" : "text-ink/65")}>{body}</p>
                {key === "design" && (
                  <dl className="mt-5 divide-y divide-white/10 rounded-2xl bg-white/[0.06] px-4 ring-1 ring-white/10">
                    {pricing.designTiers.map((t) => (
                      <div key={t.name} className="py-2.5">
                        <dt className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold">{t.name}</span>
                          <span className="font-display font-bold text-flame">{t.price}</span>
                        </dt>
                        <dd className="text-sm leading-snug text-white/55">{t.examples}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <ul className="mt-auto space-y-2 pt-5 text-sm">
                  {includes.map((i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check size={16} className="mt-0.5 flex-none text-flame" /> {i}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/60">
          {pricing.extras.map((e) => <li key={e}>{e}</li>)}
        </ul>

        <a
          href="#work"
          className="mt-8 flex flex-col gap-4 rounded-3xl bg-ink p-5 text-white sm:p-7 sm:flex-row sm:items-center sm:justify-between layer-lines"
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
