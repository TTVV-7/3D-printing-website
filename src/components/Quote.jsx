import { useEffect, useState } from "react";
import { Clock, BadgeCheck, MessageCircle, X } from "lucide-react";
import { QuoteForm } from "./QuoteForm.jsx";
import { work } from "../work.js";

const PROMISES = [
  { icon: Clock, text: "Reply within one business day" },
  { icon: BadgeCheck, text: "Fixed price before anything prints" },
  { icon: MessageCircle, text: "Real person, no account, no spam" },
];

// Photos beside the form: a replacement part first (the most common job),
// then a few that show range. Titles must match entries in work.js.
const SHOWCASE = ["Drying rack clips", "Welsh dragon phone case", "Art nouveau face vase", "Vancouver & North Shore mountains"]
  .map((t) => work.find((w) => w.title === t))
  .filter(Boolean);

// Form wording when someone arrives from "Send my design" in the Design your
// own section. The prefix tags the request in the admin panel and email.
const DESIGN = {
  detailsLabel: "What did you design?",
  detailsPlaceholder: "e.g. Name keyring for Maya, pink letters on a white base.",
  filesHint: "(STL or 3MF from the designer)",
  submitLabel: "Send my design",
  titlePrefix: "Design your own: ",
};

export function Quote() {
  const [design, setDesign] = useState(false);

  useEffect(() => {
    const on = () => setDesign(true);
    window.addEventListener("quote:design", on);
    return () => window.removeEventListener("quote:design", on);
  }, []);

  return (
    <section id="quote" className="bg-paper-dark py-16 sm:py-24 layer-lines-dark">
      <div className="container-page grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow">Free quote</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">What do you need printed?</h2>
          <p className="mt-4 text-ink/65 sm:text-lg">
            The more detail the better, but a rough description is enough to get started.
          </p>
          <ul className="mt-6 grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-2">
            {SHOWCASE.map((w) => (
              <li key={w.title} className="group relative aspect-square overflow-hidden rounded-xl bg-white ring-1 ring-ink/5 lg:rounded-2xl">
                <img
                  src={w.photo}
                  alt={w.alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  style={w.focus ? { objectPosition: w.focus } : undefined}
                />
                <span className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-ink/80 to-transparent px-3 pb-2.5 pt-8 text-xs font-medium text-white lg:block">
                  {w.title}
                </span>
              </li>
            ))}
          </ul>
          <a href="#work" className="mt-3 inline-block text-sm font-medium text-ink/60 underline decoration-flame underline-offset-4 hover:text-flame">
            See more recent work
          </a>

          <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink/70">
            {PROMISES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-1.5">
                <Icon size={15} className="text-flame" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-xl shadow-ink/5 ring-1 ring-ink/5 sm:p-8">
          {design && (
            <p className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-flame-100 px-4 py-2 text-sm font-medium text-ink">
              Sending a design from the designer
              <button
                type="button"
                onClick={() => setDesign(false)}
                className="flex items-center gap-1 text-ink/55 hover:text-ink"
              >
                Not a design <X size={14} />
              </button>
            </p>
          )}
          <QuoteForm golem {...(design ? DESIGN : {})} />
        </div>
      </div>
    </section>
  );
}
