import { Play } from "lucide-react";
import { work } from "../work.js";

export function Work() {
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

        <div className="mt-12 grid gap-4 md:h-[36rem] md:grid-cols-3 md:grid-rows-2">
          {work.map((item, i) => (
            <figure
              key={item.title}
              className={`group relative overflow-hidden rounded-3xl bg-ink ${i === 0 ? "md:row-span-2 md:col-span-2" : ""}`}
            >
              <img
                src={item.photo}
                alt={item.alt}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.03] md:aspect-auto md:h-full"
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
                    aria-label={`Watch the timelapse of ${item.title}`}
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
