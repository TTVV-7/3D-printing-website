import { useEffect, useState } from "react";
import { Menu, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import { Logo } from "./Logo.jsx";

const NAV = [
  { href: "#design", label: "Design your own" },
  { href: "#services", label: "Pricing" },
  { href: "#work", label: "Work" },
  { href: "#materials", label: "Materials" },
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
        <a href="#top" aria-label="Print Yours home">
          <Logo />
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm text-white/75" aria-label="Main">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              // The Design your own button takes over on wide screens.
              className={clsx("hover:text-white transition-colors", n.href === "#design" && "lg:hidden")}
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a href="#design" className="btn-outline-light h-10 px-5 text-sm hidden lg:inline-flex">
            <Sparkles size={15} className="text-flame" /> Design your own
          </a>
          <a href="#quote" className="btn-primary h-9 px-4 text-sm sm:h-10 sm:px-5">
            <span className="sm:hidden">Quote</span>
            <span className="hidden sm:inline">Get a free quote</span>
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
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="py-2.5 text-lg font-display border-b border-white/10 last:border-0"
            >
              {n.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
