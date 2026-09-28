import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { getConsent, setConsent, onConsentChange } from "../lib/consent.js";

// Shown on the first visit until the visitor accepts or declines. Sits bottom
// left on larger screens so it doesn't cover the golem in the right corner.
export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(getConsent() === null);
    return onConsentChange((value) => setOpen(value === null));
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-3 z-50 rounded-2xl bg-ink p-5 text-white shadow-2xl ring-1 ring-white/10 sm:inset-x-auto sm:left-4 sm:bottom-4 sm:max-w-sm"
    >
      <div className="flex items-start gap-3">
        <Cookie size={22} className="mt-0.5 shrink-0 text-flame" aria-hidden />
        <div>
          <p className="font-display text-base font-semibold">Cookies?</p>
          <p className="mt-1 text-sm leading-relaxed text-white/70">
            This site uses cookies and similar storage to remember your preferences and see how the
            site is used. You can accept or decline; the site works either way.
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" className="btn-primary h-10 flex-1 px-4 text-sm" onClick={() => setConsent("accepted")}>
          Accept
        </button>
        <button type="button" className="btn-outline-light h-10 flex-1 px-4 text-sm" onClick={() => setConsent("declined")}>
          Decline
        </button>
      </div>
    </div>
  );
}
