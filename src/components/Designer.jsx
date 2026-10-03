import { ArrowUpRight, ArrowRight } from "lucide-react";
import { site } from "../../site.config.js";
import { products } from "../pages.js";

// One card per product page (src/pages.js, group "product"). Each card leads
// to that product's page on this site, which then links into the generator
// app -- so search engines see the products on printyours.ca itself.
const BLURBS = {
  "nfc-business-card": "Your logo becomes the card, with an NFC chip inside. Tap a phone to open your link.",
  "custom-name-keychain": "The name itself as the keychain, in any of 48 typefaces from clean to blackletter.",
  "custom-pet-tags": "Name on the front, your number, a QR code or tap-to-call NFC on the back.",
  "custom-phone-case": "Pick your iPhone, drop in your artwork, and see the case redraw in colour.",
  "light-up-signs": "A slim light box with your word or logo lit through the face.",
  "custom-stencils": "A word or an SVG cut clean through a plate, every letter centre bridged in.",
};

export function Designer() {
  return (
    <section id="design" className="bg-ink py-20 text-white sm:py-28 layer-lines relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-flame/15 blur-[120px]"
      />
      <div className="container-page relative">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Design your own</p>
            <h2 className="mt-3 text-4xl font-bold sm:text-5xl">Make it yours in the browser.</h2>
            <p className="mt-4 text-lg text-white/65">
              Type your name, pick a style and watch the 3D model rebuild live. Nothing to install.
              Once you like it, send it over and I'll print it and ship it to you.
            </p>
          </div>
          <a href={site.designerUrl} target="_blank" rel="noopener" className="btn-primary self-start lg:self-auto">
            Open the designer <ArrowUpRight size={18} />
          </a>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <li key={p.slug}>
              <a
                href={`/${p.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white/[0.04] ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:ring-flame/60"
              >
                <div className={`relative aspect-[4/3] overflow-hidden ${p.photoFit === "contain" ? "bg-white" : "bg-ink-800"}`}>
                  <img
                    src={p.photo}
                    alt={p.photoAlt}
                    loading="lazy"
                    className={`h-full w-full transition ${p.photoFit === "contain" ? "object-contain p-3" : "object-cover"} duration-500 group-hover:scale-105`}
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="flex items-start justify-between gap-2 text-lg font-semibold leading-snug">
                    {p.nav}
                    <ArrowRight
                      size={18}
                      className="mt-0.5 flex-none text-white/40 transition group-hover:text-flame"
                    />
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">{BLURBS[p.slug]}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm text-white/50">
          Have a design ready? Download the file from the designer and attach it to a{" "}
          <a href="/quote" className="text-flame underline-offset-4 hover:underline">
            quote request
          </a>
          .
        </p>
      </div>
    </section>
  );
}
