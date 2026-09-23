import { ArrowUpRight, Smartphone, Sparkles } from "lucide-react";
import { site } from "../../site.config.js";

// Each of these is a shape in the generator app (3D-print-sandbox repo).
// The app opens on the fob and you pick the others from its Shape panel.
const GENERATORS = [
  {
    title: "NFC business fob",
    body: "Your details on the front and an NFC tag sealed inside. Tap a phone to it and it opens your link.",
    image: "/designer/nfc_fob.webp",
    alt: "Black keyring fob printed with a name, company and phone number",
    path: "/",
  },
  {
    title: "Name keyring",
    body: "The name itself as the keyring, in any of 48 typefaces from clean to comic to blackletter.",
    image: "/designer/keyring.webp",
    alt: "Green and white 3D-printed name keyring spelling Freddie",
    path: "/",
  },
  {
    title: "Light-up sign",
    body: "A slim light box with your word or logo lit through the face. Good for shopfronts and desks.",
    image: "/designer/sign.webp",
    alt: "Dark sign enclosure with the word OPEN lit through its face",
    path: "/",
  },
  {
    title: "Stencil",
    body: "A word or an SVG cut clean through a plate, with every island bridged so letter centres stay put.",
    image: "/designer/stencil.webp",
    alt: "Red plastic stencil plate with the word SHOP cut through it",
    path: "/",
  },
  {
    title: "Custom phone case",
    body: "Pick your iPhone, drop in your own artwork, and see the back of the case redraw in colour.",
    icon: Smartphone,
    path: "/case",
  },
];

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
              Once you like it, send it over and I'll print it.
            </p>
          </div>
          <a href={site.designerUrl} target="_blank" rel="noopener" className="btn-primary self-start lg:self-auto">
            Open the designer <ArrowUpRight size={18} />
          </a>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {GENERATORS.map(({ title, body, image, alt, icon: Icon, path }) => (
            <li key={title}>
              <a
                href={site.designerUrl + path}
                target="_blank"
                rel="noopener"
                className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white/[0.04] ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:ring-flame/60"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-ink-800">
                  {image ? (
                    <img
                      src={image}
                      alt={alt}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-ink-700 to-ink-800">
                      <Icon size={56} strokeWidth={1.25} className="text-sky" />
                      <Sparkles size={22} className="absolute right-[34%] top-[26%] text-flame" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="flex items-start justify-between gap-2 text-lg font-semibold leading-snug">
                    {title}
                    <ArrowUpRight
                      size={18}
                      className="mt-0.5 flex-none text-white/40 transition group-hover:text-flame"
                    />
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">{body}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm text-white/50">
          Have a design ready? Download the file from the designer and attach it to a{" "}
          <a href="#quote" className="text-flame underline-offset-4 hover:underline">
            quote request
          </a>
          .
        </p>
      </div>
    </section>
  );
}
