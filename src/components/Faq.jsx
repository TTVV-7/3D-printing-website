import { Plus } from "lucide-react";
import { faqs } from "../../site.config.js";

export function Faq() {
  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <div>
          <p className="eyebrow">FAQ</p>
          <h2 className="mt-3 text-4xl font-bold sm:text-5xl">Good questions.</h2>
          <p className="mt-4 text-ink/65">
            Anything else? Put it in the quote form. There's no commitment until you approve a price.
          </p>
        </div>

        <div className="divide-y divide-ink/10 border-y border-ink/10">
          {faqs.map(({ q, a }) => (
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
