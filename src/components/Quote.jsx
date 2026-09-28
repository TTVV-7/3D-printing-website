import { Clock, BadgeCheck, MessageCircle } from "lucide-react";
import { QuoteForm } from "./QuoteForm.jsx";

const PROMISES = [
  { icon: Clock, text: "Reply within one business day" },
  { icon: BadgeCheck, text: "Fixed price before anything prints" },
  { icon: MessageCircle, text: "Real person, no account, no spam" },
];

export function Quote() {
  return (
    <section id="quote" className="bg-paper-dark py-20 sm:py-28 layer-lines-dark">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div>
          <p className="eyebrow">Free quote</p>
          <h2 className="mt-3 text-4xl font-bold sm:text-5xl">What do you need printed?</h2>
          <p className="mt-4 text-lg text-ink/65">
            The more detail the better, but a rough description is enough to get started.
          </p>
          <ul className="mt-8 space-y-4">
            {PROMISES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 font-medium">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-flame">
                  <Icon size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl shadow-ink/5 ring-1 ring-ink/5 sm:p-8">
          <QuoteForm />
        </div>
      </div>
    </section>
  );
}
