import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { clsx } from "clsx";

const NAV = [
  { href: "#services", label: "Services" },
  { href: "#materials", label: "Materials" },
  { href: "#work", label: "Work" },
  { href: "#faq", label: "FAQ" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={clsx(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled || open ? "bg-ink/95 backdrop-blur border-b border-white/10" : "bg-transparent",
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4 text-white">
        <a href="#top" className="flex items-center gap-2.5" aria-label="MAP3D home">
          <img src="/logo.png" alt="" width="36" height="36" className="h-9 w-9 rounded-full" />
          <span className="font-display text-lg font-bold tracking-tight">MAP3D</span>
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm text-white/75" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-white transition-colors">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a href="#quote" className="btn-primary h-10 px-5 text-sm hidden sm:inline-flex">
            Get a free quote
          </a>
          <button
            type="button"
            className="md:hidden p-2 -mr-2 rounded-lg hover:bg-white/10"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="md:hidden container-page pb-5 flex flex-col gap-1 text-white" aria-label="Mobile">
          {[...NAV, { href: "#quote", label: "Get a free quote" }].map((n) => (
            <a
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="py-2.5 text-lg font-display border-b border-white/10 last:border-0 last:text-flame"
            >
              {n.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
