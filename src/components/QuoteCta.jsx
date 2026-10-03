import { ArrowRight } from "lucide-react";

// Closing call to action on the home page; the form itself lives at /quote.
export function QuoteCta() {
  return (
    <section className="bg-paper-dark py-20 sm:py-24 layer-lines-dark">
      <div className="container-page flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="eyebrow">Free quote</p>
          <h2 className="mt-3 text-4xl font-bold sm:text-5xl">What do you need printed?</h2>
          <p className="mt-4 text-lg text-ink/65">
            Send a file, a link or a photo. You'll get a fixed price within one business day, with no
            obligation.
          </p>
        </div>
        <a href="/quote" className="btn-primary">
          Get a free quote <ArrowRight size={18} />
        </a>
      </div>
    </section>
  );
}
