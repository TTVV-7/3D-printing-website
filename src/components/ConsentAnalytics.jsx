import { useEffect, useState } from "react";
import * as analytics from "@vercel/analytics/react";
import { hasConsent, onConsentChange } from "../lib/consent.js";

// Vercel Web Analytics, loaded only after the visitor accepts cookies. If they
// later decline via "Cookie settings", beforeSend drops every further event.
// The Cloudflare build's stand-in (cloudflare/client/analytics.js) counts
// anonymously, so it loads straight away and only adds a visitor id once the
// visitor accepts (it checks consent itself).
export const cookieless = Boolean(analytics.cookieless);
export const anonymous = cookieless || Boolean(analytics.anonymous);

export function ConsentAnalytics() {
  const [enabled, setEnabled] = useState(anonymous);

  useEffect(() => {
    if (anonymous) return;
    setEnabled(hasConsent());
    return onConsentChange((value) => value === "accepted" && setEnabled(true));
  }, []);

  if (!enabled) return null;
  return <analytics.Analytics beforeSend={(event) => (anonymous || hasConsent() ? event : null)} />;
}
