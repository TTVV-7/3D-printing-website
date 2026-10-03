import { site } from "../../site.config.js";
import { services, products } from "../pages.js";
import { Logo } from "./Logo.jsx";

const LABELS = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  makerworld: "MakerWorld",
};

export function Footer() {
  const socials = Object.entries(site.social).filter(([, href]) => href);

  return (
    <footer className="bg-ink text-white/60">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo className="text-white" />
          <p className="mt-2 text-sm">
            Custom 3D printing · {site.city}, {site.region}
          </p>
          <p className="mt-1 max-w-sm text-xs text-white/40">
            Pickup in {site.localArea.join(", ")}. Shipping across {site.shipsTo}.
          </p>
        </div>

        {[
          ["Services", services],
          ["Design your own", products],
        ].map(([label, list]) => (
          <nav key={label} className="flex flex-col gap-2 text-sm" aria-label={label}>
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">{label}</p>
            {list.map((p) => (
              <a key={p.slug} href={`/${p.slug}`} className="hover:text-white">
                {p.nav}
              </a>
            ))}
          </nav>
        ))}

        <nav className="flex flex-col gap-2 text-sm" aria-label="More">
          <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">More</p>
          <a href="/work" className="hover:text-white">Recent work</a>
          <a href="/materials" className="hover:text-white">Materials</a>
          <a href="/faq" className="hover:text-white">FAQ</a>
          {site.email && (
            <a href={`mailto:${site.email}`} className="hover:text-white">
              {site.email}
            </a>
          )}
          {socials.map(([key, href]) => (
            <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              {LABELS[key] || key}
            </a>
          ))}
          <a href="/quote" className="text-flame hover:text-white">
            Get a quote
          </a>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-5 text-xs text-white/40">
          © {new Date().getFullYear()} {site.name}. Printed in Vancouver.
        </p>
      </div>
    </footer>
  );
}
