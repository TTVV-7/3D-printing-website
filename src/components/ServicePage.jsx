import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { pages } from "../pages.js";
import { faqs as sharedFaqs } from "../../site.config.js";
import { Materials } from "./Materials.jsx";
import { Process } from "./Process.jsx";
import { Faq } from "./Faq.jsx";
import { Quote } from "./Quote.jsx";

// Shared questions worth repeating on every service page.
const COMMON = sharedFaqs.filter((f) => /cost|ship/i.test(f.q));

export function ServicePage({ page }) {
  const related = pages.filter((p) => p.slug !== page.slug);

  return (
    <>
      <section id="top" className="relative overflow-hidden bg-ink text-white layer-lines">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-flame/25 blur-[120px]"
        />
        <div
          className={`container-page relative grid items-center gap-12 pt-28 pb-20 sm:pt-32 lg:pb-24 ${
            page.photo ? "lg:grid-cols-[1.15fr_1fr]" : ""
          }`}
        >
          <div className="max-w-3xl">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-white/50">
              <a href="/" className="hover:text-white">Home</a>
              <ChevronRight size={14} />
              <span className="text-white/75">{page.nav}</span>
            </nav>
            <p className="eyebrow mt-6">{page.eyebrow}</p>
            <h1 className="mt-4 text-4xl leading-[1.05] font-bold sm:text-5xl lg:text-6xl">{page.h1}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">{page.intro}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#quote" className="btn-primary">
                Get a free quote <ArrowRight size={18} />
              </a>
              <a href="/#work" className="btn-outline-light">
                See recent work
              </a>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
              {page.points.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <Check size={16} className="text-flame" /> {p}
                </li>
              ))}
            </ul>
          </div>

          {page.photo && (
            <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] ring-1 ring-white/15 shadow-2xl shadow-black/40 rotate-[1.5deg] lg:max-w-none">
              <img src={page.photo} alt={page.photoAlt} className="h-full w-full object-cover" fetchpriority="high" />
            </div>
          )}
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="container-page">
          <div className="grid gap-4 sm:grid-cols-2">
            {page.uses.map((u) => (
              <article key={u.title} className="rounded-3xl bg-white p-7 ring-1 ring-ink/5">
                <h2 className="text-xl font-semibold">{u.title}</h2>
                <p className="mt-2 leading-relaxed text-ink/65">{u.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-16 grid gap-12 lg:grid-cols-2">
            {page.sections.map((s) => (
              <div key={s.h2}>
                <h2 className="text-3xl font-bold sm:text-4xl">{s.h2}</h2>
                {s.body.map((para) => (
                  <p key={para.slice(0, 32)} className="mt-4 text-lg leading-relaxed text-ink/65">
                    {para}
                  </p>
                ))}
              </div>
            ))}
          </div>

          {page.gallery && (
            <div className="mt-16 grid gap-4 sm:grid-cols-2">
              {page.gallery.map((g) => (
                <img
                  key={g.src}
                  src={g.src}
                  alt={g.alt}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-3xl object-cover"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {page.slug !== "custom-topographic-maps" && <Materials />}
      <Process />
      <Faq items={[...page.faqs, ...COMMON]} />

      <section className="pb-20 sm:pb-28">
        <div className="container-page">
          <h2 className="text-2xl font-bold">Other 3D printing services</h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {related.map((p) => (
              <li key={p.slug}>
                <a
                  href={`/${p.slug}`}
                  className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium ring-1 ring-ink/10 hover:ring-flame"
                >
                  {p.nav}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Quote />
    </>
  );
}
