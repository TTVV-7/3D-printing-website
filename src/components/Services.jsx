import { Printer, PenTool, Boxes, Check, Mountain } from "lucide-react";
import { clsx } from "clsx";
import { pricing } from "../../site.config.js";

const ICONS = { print: Printer, design: PenTool, batch: Boxes };

export function Services() {
  return (
    <section id="services" className="py-16 sm:py-28">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="eyebrow">Services & pricing</p>
          <h2 className="mt-3 text-4xl font-bold sm:text-5xl">Clear prices, fixed before printing.</h2>
          <p className="mt-4 text-lg text-ink/65">
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
                <h3 className="mt-5 text-2xl font-semibold">{title}</h3>
                <p className="mt-3">
                  <span className="font-display text-4xl font-bold">{price}</span>
                  <span className={clsx("ml-2 text-sm", featured ? "text-white/55" : "text-ink/50")}>{unit}</span>
                </p>
                <p className={clsx("mt-3 leading-relaxed", featured ? "text-white/70" : "text-ink/65")}>{body}</p>
                <ul className="mt-5 space-y-2 text-sm">
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

        <div className="mt-4 rounded-3xl bg-white p-5 ring-1 ring-ink/5 sm:p-7">
          <h3 className="text-xl font-semibold">Custom design prices</h3>
          <p className="mt-1 text-ink/60">
            Fixed per part, agreed before I start. If a job turns out bigger than quoted, that's on me.
          </p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            {pricing.designTiers.map((t) => (
              <div key={t.name} className="rounded-2xl bg-paper p-5">
                <dt className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{t.name}</span>
                  <span className="font-display text-xl font-bold text-flame">{t.price}</span>
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-ink/60">{t.examples}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/60">
            {pricing.extras.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>

        <a
          href="#work"
          className="mt-4 flex flex-col gap-4 rounded-3xl bg-ink p-5 text-white sm:p-7 sm:flex-row sm:items-center sm:justify-between layer-lines"
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
