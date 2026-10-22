import { useEffect, useRef } from "react";
import { ExternalLink, X } from "lucide-react";
import { track } from "@vercel/analytics";
import { CHANNEL, shortUrl } from "../shorts.js";

// Plays one YouTube Short in a pop-up, so people stay on the site. The video
// only loads once someone presses play, from youtube-nocookie.com.
export function ShortPlayer({ id, title, onClose }) {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    track("Video played", { video: id });
  }, [id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div data-short-player className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[22rem] flex-col gap-3">
        <div className="flex items-center justify-between gap-3 text-white">
          <p className="truncate font-semibold">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="flex-none rounded-full bg-white/10 p-2 hover:bg-white/20">
            <X size={18} />
          </button>
        </div>
        <div className="relative aspect-[9/16] max-h-[75vh] overflow-hidden rounded-2xl bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
        <div className="flex gap-2">
          <a href={shortUrl(id)} target="_blank" rel="noopener noreferrer" className="btn-outline-light h-10 flex-1 px-3 text-sm">
            Watch on YouTube <ExternalLink size={14} />
          </a>
          <a href={`${CHANNEL}?sub_confirmation=1`} onClick={() => track("Subscribe clicked", { from: "player" })} target="_blank" rel="noopener noreferrer" className="btn-primary h-10 flex-1 px-3 text-sm">
            Subscribe
          </a>
        </div>
      </div>
    </div>
  );
}
