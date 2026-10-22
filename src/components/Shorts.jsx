import { useState } from "react";
import { Play, Youtube } from "lucide-react";
import { track } from "@vercel/analytics";
import { CHANNEL, shorts, shortThumb } from "../shorts.js";
import { ShortPlayer } from "./ShortPlayer.jsx";

// "From the shop": the latest YouTube Shorts (src/shorts.js) as a row of tall
// cards that play in a pop-up, with a link to subscribe to the channel.
export function Shorts() {
  const [playing, setPlaying] = useState(null);

  return (
    <section id="videos" className="bg-ink py-16 text-white sm:py-24">
      <div className="container-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">From the shop</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Watch it print.</h2>
            <p className="mt-3 text-white/65">Timelapses and new builds, posted on YouTube most weeks.</p>
          </div>
          <a href={`${CHANNEL}?sub_confirmation=1`} onClick={() => track("Subscribe clicked", { from: "home" })} target="_blank" rel="noopener noreferrer" className="btn-primary self-start sm:self-auto">
            <Youtube size={18} /> Subscribe on YouTube
          </a>
        </div>

        <ul className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {shorts.map((s) => (
            <li key={s.id} className="w-40 flex-none snap-start sm:w-48">
              <button
                type="button"
                onClick={() => setPlaying(s)}
                className="group relative block aspect-[9/16] w-full overflow-hidden rounded-2xl bg-white/5 text-left"
                aria-label={`Play: ${s.title}`}
              >
                <img src={shortThumb(s.id)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" />
                <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-flame/90 opacity-90 transition group-hover:scale-110 group-hover:opacity-100">
                  <Play size={18} className="ml-0.5" fill="currentColor" />
                </span>
                <span className="absolute inset-x-0 bottom-0 p-3 text-sm font-semibold leading-tight">{s.title}</span>
              </button>
              {s.model && (
                <a href={`/models/${s.model}/`} className="mt-2 block text-xs font-medium text-flame hover:text-white">
                  Get one printed →
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>

      {playing && <ShortPlayer id={playing.id} title={playing.title} onClose={() => setPlaying(null)} />}
    </section>
  );
}
