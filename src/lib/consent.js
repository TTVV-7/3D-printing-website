// Cookie consent, remembered in localStorage. Anything that sets non-essential
// cookies (analytics, pixels, embeds) should check hasConsent() first, or wait
// for onConsentChange().

const KEY = "printyours-cookie-consent";
const EVENT = "cookie-consent-change";

// "accepted", "declined" or null (not asked yet / storage unavailable).
export function getConsent() {
  try {
    const value = localStorage.getItem(KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function setConsent(value) {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or blocked storage: the choice just won't be remembered.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
}

export const hasConsent = () => getConsent() === "accepted";

export function onConsentChange(cb) {
  const handler = (e) => cb(e.detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

// Clears the saved choice so the banner shows again (footer "Cookie settings").
export const reopenConsent = () => setConsent(null);
