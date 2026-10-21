import { ArrowRight, Bike, Clock, Layers, ShieldCheck, Users } from "lucide-react";
import { ClubForm } from "./ClubForm.jsx";

// The /bike page: ready-made bike sticker templates (each opens the sticker
// maker filled in, src/stickers/presets.js), 3D-printed bike parts, and
// club and team orders (ClubForm.jsx). Template pictures in public/bike/ are
// renders of those presets.

const TEMPLATES = [
  {
    key: "frame-name",
    title: "Frame name decal",
    body: "Your name, or your bike's, for the top tube. A 4\" × 2\" label in any of six fonts.",
    img: "/bike/frame-name.png",
  },
  {
    key: "trail",
    title: "Trail sticker",
    body: "Your favourite trail over topo lines, with a ring of pines. Swap the border for bikes or mountains.",
    img: "/bike/trail.png",
  },
  {
    key: "ice",
    title: "Emergency ID",
    body: "Name and an emergency number on your frame or helmet, for when you can't speak for yourself.",
    img: "/bike/ice.png",
  },
];

const PRINTS = [
  ["Race number plates", "Printed plates sized for your bars, with your number or a club sticker on them."],
  ["Computer and light mounts", "Out-front mounts, AirTag holders and light brackets, made to fit your cockpit."],
  ["Replacement bits", "Cable guides, bumpers, caps and clips that are hard to find, matched from a photo."],
];

const WHY = [
  { icon: Clock, title: "Fast and local", body: "Pickup in Vancouver, usually in one or two business days." },
  { icon: Users, title: "No minimums", body: "Ten stickers or five hundred. Small clubs welcome." },
  { icon: Layers, title: "Stickers and prints", body: "Match a club sticker with mounts, plates or keychains." },
  { icon: ShieldCheck, title: "Your logo, done right", body: "Proofed before printing. Only logos you own or are allowed to use." },
];

export function BikePage() {
  return (
    <>
      <section className="bg-ink pb-16 pt-28 text-white sm:pb-20 sm:pt-32">
        <div className="container-page">
          <p className="eyebrow text-flame">For riders, clubs and shops</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold sm:text-6xl">Stickers and parts for your bike.</h1>
          <p className="mt-5 max-w-2xl text-white/70 sm:text-lg">
            Frame decals, trail stickers and club logos, printed in Vancouver with no minimums. Plus 3D-printed
            plates, mounts and the small parts that break on the trail.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#templates" className="btn-primary">
              <Bike size={18} /> Design a bike sticker
            </a>
            <a href="#clubs" className="btn-outline-light">
              Club and team orders <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      <section id="templates" className="bg-paper py-16 sm:py-20">
        <div className="container-page">
          <p className="eyebrow">Start from a template</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Pick one, make it yours.</h2>
          <p className="mt-3 max-w-2xl text-ink/65">
            Each opens in the sticker maker ready to edit: change the words, the font, the label or the border, and see
            it to scale before you order.
          </p>
          <ul className="mt-8 grid gap-5 md:grid-cols-3">
            {TEMPLATES.map((t) => (
              <li key={t.key}>
                <a
                  href={`/stickers/?preset=${t.key}`}
                  className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-ink/10 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-ink/5"
                >
                  <span className="flex aspect-[4/3] items-center justify-center bg-[#e9efe9] p-8">
                    <img src={t.img} alt="" loading="lazy" className="max-h-full max-w-full drop-shadow-md" />
                  </span>
                  <span className="flex flex-1 flex-col p-5">
                    <span className="text-lg font-semibold">{t.title}</span>
                    <span className="mt-1 flex-1 text-sm text-ink/60">{t.body}</span>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-flame group-hover:gap-2.5 transition-all">
                      Make this sticker <ArrowRight size={15} />
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-ink/55">
            Got your own art or a photo of your bike?{" "}
            <a href="/stickers/" className="font-medium text-ink underline decoration-flame underline-offset-4 hover:text-flame">
              Start from your image
            </a>
            .
          </p>
        </div>
      </section>

      <section className="bg-paper-dark py-16 layer-lines-dark sm:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="eyebrow">3D printed</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Parts for the bike, too.</h2>
            <p className="mt-3 text-ink/65">
              Send a photo, a model file or a rough description and get a fixed price within one business day.
            </p>
            <a href="/#quote" className="btn-primary mt-6">
              Get a free quote <ArrowRight size={16} />
            </a>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {PRINTS.map(([title, body]) => (
              <li key={title} className="rounded-2xl bg-white p-5 ring-1 ring-ink/5">
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-ink/60">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-paper py-12 sm:py-16">
        <ul className="container-page grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-flame/10 text-flame">
                <Icon size={18} />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm text-ink/60">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section id="clubs" className="bg-paper-dark py-16 layer-lines-dark sm:py-24">
        <div className="container-page grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="eyebrow">Clubs, teams and shops</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Your logo, on stickers and more.</h2>
            <p className="mt-4 text-ink/65 sm:text-lg">
              Riding clubs, race teams, trail crews, shops and coaches. Send your logo and how many you need, and I'll
              come back with a proof and a fixed price.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-ink/70">
              <li>Race-day stickers, fast</li>
              <li>Member packs: stickers with keychains or valve caps</li>
              <li>Mixed designs in one order</li>
            </ul>
            <p className="mt-6 rounded-2xl bg-white p-4 text-sm text-ink/65 ring-1 ring-ink/5">
              <span className="font-semibold text-ink">Bike brands and shops:</span> replacement frame decals or a limited
              run, made with your OK. Get in touch with the form.
            </p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-xl shadow-ink/5 ring-1 ring-ink/5 sm:p-8">
            <ClubForm />
          </div>
        </div>
      </section>
    </>
  );
}
