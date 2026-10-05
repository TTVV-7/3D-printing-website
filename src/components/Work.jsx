import { Play } from "lucide-react";
import { work } from "../work.js";

// Desktop grid is 3 columns. The first photo is a 2x2 feature tile with the
// next two stacked beside it; after that, photos flow in rows of 3 (`wide`
// ones take 2 columns). The last photo in a row stretches to fill any gap.
const SPAN = { 1: "", 2: "md:col-span-2", 3: "md:col-span-3" };

function tileSpans(items) {
  const spans = items.map((item, i) => (i === 0 ? 4 : item.wide ? 2 : 1));
  let col = 0;
  for (let i = 3; i < items.length; i++) {
    if (col + spans[i] > 3) {
      spans[i - 1] += 3 - col;
      col = 0;
    }
    col = (col + spans[i]) % 3;
  }
  if (items.length > 3 && col !== 0) spans[items.length - 1] += 3 - col;
  return spans.map((n) => (n === 4 ? "md:row-span-2 md:col-span-2" : SPAN[n]));
}

export function Work() {
  const spans = tileSpans(work);
  return (
    <section id="work" className="py-20 sm:py-28">
      <div className="container-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Recent work</p>
            <h2 className="mt-3 text-4xl font-bold sm:text-5xl">Fresh off the build plate.</h2>
          </div>
          <a href="#quote" className="btn-outline-dark self-start sm:self-auto">
            Start your project
          </a>
        </div>

        <div className="mt-12 grid gap-4 md:auto-rows-[17.5rem] md:grid-cols-3">
          {work.map((item, i) => (
            <figure
              key={item.title}
              className={`group relative overflow-hidden rounded-3xl bg-ink ${spans[i]}`}
            >
              <img
                src={item.photo}
                alt={item.alt}
                loading="lazy"
                className={`${item.wide ? "aspect-[12/5]" : "aspect-[4/3]"} w-full object-cover transition duration-500 group-hover:scale-[1.03] md:aspect-auto md:h-full`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
              <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-white">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-white/60">{item.kind}</p>
                  <p className="font-display text-lg font-semibold leading-tight">{item.title}</p>
                </div>
                {item.video && (
                  <a
                    href={item.video}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-flame text-white hover:bg-flame-600"
                    aria-label={`Watch a video of ${item.title}`}
                  >
                    <Play size={16} className="ml-0.5" fill="currentColor" />
                  </a>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
