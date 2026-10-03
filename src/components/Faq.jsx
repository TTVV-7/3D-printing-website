import { Plus } from "lucide-react";
import { faqs } from "../../site.config.js";

export function Faq({ items = faqs, standalone = false }) {
  // Standalone = its own page (/quote, /work...): the heading becomes the h1.
  const Heading = standalone ? "h1" : "h2";
  const pad = standalone ? "pt-32 pb-20 sm:pt-36 sm:pb-28" : "py-20 sm:py-28";
  return (
    <section id="faq" className={pad}>
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <div>
          <p className="eyebrow">FAQ</p>
          <Heading className="mt-3 text-4xl font-bold sm:text-5xl">{standalone ? "3D printing FAQ: questions, answered." : "3D printing questions, answered."}</Heading>
          <p className="mt-4 text-ink/65">
            Anything else? Put it in the <a href="/quote" className="text-flame underline-offset-4 hover:underline">quote form</a>. There's no commitment until you approve a price.
          </p>
        </div>

        <div className="divide-y divide-ink/10 border-y border-ink/10">
          {items.map(({ q, a }) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <Plus size={20} className="flex-none text-flame transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-3 max-w-2xl leading-relaxed text-ink/65">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
