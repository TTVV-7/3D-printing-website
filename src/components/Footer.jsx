import { site } from "../../site.config.js";

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
      <div className="container-page flex flex-col gap-8 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" width="40" height="40" loading="lazy" className="h-10 w-10 rounded-full" />
          <div>
            <p className="font-display text-lg font-bold text-white">{site.name}</p>
            <p className="text-sm">
              3D printing · {site.city}, {site.region}
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Social and contact">
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
          <a href="#quote" className="text-flame hover:text-white">
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
