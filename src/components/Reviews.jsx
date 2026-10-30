import { Star, ExternalLink, PenLine } from "lucide-react";
import { reviews } from "../../site.config.js";

function Stars({ rating }) {
  return (
    <div className="flex gap-0.5 text-flame" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={16} fill={i < rating ? "currentColor" : "none"} />
      ))}
    </div>
  );
}

// Shared with the header so the nav link only shows when the section does.
export const hasReviews = Boolean(
  reviews.items.length || reviews.marketplaceUrl || reviews.googleUrl || reviews.googleReviewUrl,
);

export function Reviews() {
  const { items, marketplaceUrl, googleUrl, googleReviewUrl } = reviews;
  const links = [
    googleUrl && { href: googleUrl, label: "Reviews on Google" },
    marketplaceUrl && { href: marketplaceUrl, label: "Reviews on Facebook Marketplace" },
  ].filter(Boolean);

  if (!hasReviews) return null;

  return (
    <section id="reviews" className="py-16 sm:py-24">
      <div className="container-page">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Reviews</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">What customers say.</h2>
          </div>
          {links.length > 0 && (
            <div className="flex flex-col gap-2 sm:items-end">
              {links.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline-dark self-start sm:self-auto"
                >
                  {label} <ExternalLink size={16} />
                </a>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((r) => (
              <li key={r.name + r.text} className="flex flex-col rounded-3xl bg-white p-7 ring-1 ring-ink/5">
                {r.rating && <Stars rating={r.rating} />}
                <blockquote className="mt-4 flex-1 leading-relaxed text-ink/75">“{r.text}”</blockquote>
                <p className="mt-5 text-sm">
                  <span className="font-semibold">{r.name}</span>
                  {r.source && <span className="text-ink/45"> · {r.source}</span>}
                </p>
              </li>
            ))}
          </ul>
        )}

        {googleReviewUrl && (
          <div className="mt-12 flex flex-col gap-5 rounded-3xl bg-white p-7 ring-1 ring-ink/5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-xl font-bold">Had something printed?</p>
              <p className="mt-1 text-ink/65">
                A quick Google review helps other people in Vancouver find a small shop like this one.
              </p>
            </div>
            <a
              href={googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary shrink-0 self-start sm:self-auto"
            >
              <PenLine size={16} /> Write a review
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
