import { useEffect, useState } from "react";
import { Clock, BadgeCheck, MessageCircle, Mail, X } from "lucide-react";
import { QuoteForm } from "./QuoteForm.jsx";
import { site } from "../../site.config.js";

const PROMISES = [
  { icon: Clock, text: "Reply within one business day" },
  { icon: BadgeCheck, text: "Fixed price before anything prints" },
  { icon: MessageCircle, text: "Real person, no account, no spam" },
];

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
          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink/70 lg:mt-8 lg:block lg:space-y-4 lg:text-base lg:text-ink">
            {PROMISES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-1.5 lg:gap-3 lg:font-medium">
                <span className="flex items-center justify-center text-flame lg:h-10 lg:w-10 lg:rounded-xl lg:bg-white">
                  <Icon size={16} />
                </span>
                {text}
              </li>
            ))}
          </ul>
          {site.email && (
            <p className="mt-5 flex items-start gap-3 text-sm text-ink/65 lg:mt-8 lg:text-base">
              <Mail size={18} className="mt-1 flex-shrink-0 text-flame" />
              <span>
                Form not working, or rather email? Send your files and details to{" "}
                <a href={`mailto:${site.email}`} className="font-medium text-ink underline decoration-flame underline-offset-4 hover:text-flame">
                  {site.email}
                </a>
              </span>
            </p>
          )}
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
