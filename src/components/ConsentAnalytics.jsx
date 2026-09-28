import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { hasConsent, onConsentChange } from "../lib/consent.js";

// Vercel Web Analytics, loaded only after the visitor accepts cookies. If they
// later decline via "Cookie settings", beforeSend drops every further event.
export function ConsentAnalytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(hasConsent());
    return onConsentChange((value) => value === "accepted" && setEnabled(true));
  }, []);

  if (!enabled) return null;
  return <Analytics beforeSend={(event) => (hasConsent() ? event : null)} />;
}
