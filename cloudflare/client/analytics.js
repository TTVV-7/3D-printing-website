// Browser stand-ins for @vercel/analytics and @vercel/speed-insights in the
// Cloudflare build (vite.config.js aliases them here when CF_BUILD is set).
// Vercel's scripts live at /_vercel/... and would only 404 off Vercel.
//
// <Analytics /> loads Cloudflare Web Analytics (page views, referrers,
// countries, speed): the site token is site.analytics.cloudflareToken in
// site.config.js, or VITE_CF_ANALYTICS_TOKEN at build time. See it under
// Cloudflare dashboard > Analytics & Logs > Web Analytics.
//
// track() sends custom events (a quote sent, a sticker checkout...) to
// /api/event, which keeps them in D1 (cloudflare/events.js); admins see them
// charted on /account/ (Stats) and listed on /api/stats. Each one carries
// where the visitor came from (YouTube, Google, Marketplace...), so you can
// see which channel brings orders. <Analytics /> also sends a "Page view" for
// every page and a "Click" for every link and button pressed (its text or
// data-track label, never what anyone typed).
//
// Counting works without cookies and nothing personal is sent, so it runs
// straight away (`anonymous`). The cookie banner asks for one thing more:
// visitors who accept get a random visitor id kept in their browser, so
// return visits can be counted, and the server notes their city. Decline (or
// no answer) and the counts stay anonymous. ConsentAnalytics.jsx and
// CookieBanner.jsx read these flags.
import { useEffect } from "react";
import { site } from "../../site.config.js";
import { hasConsent, onConsentChange } from "../../src/lib/consent.js";

const TOKEN = import.meta.env.VITE_CF_ANALYTICS_TOKEN || site.analytics?.cloudflareToken;
export const cookieless = false;
export const anonymous = true;

// Your own visits to these pages would only add noise. (Signed-in admins are
// left out of every count server side too.)
const QUIET = /^\/account\//;

// What a click was on: its data-track label, else its text, else its
// accessible name. Anything showing what a visitor typed or uploaded (a file
// name...) should carry data-track or data-no-track.
function clickLabel(el) {
  const text = el.dataset.track || el.textContent?.trim() || el.getAttribute("aria-label") || el.title || el.querySelector("img")?.alt || "";
  return text.replace(/\s+/g, " ").trim().slice(0, 80);
}
function onClick(e) {
  const el = e.target instanceof Element && e.target.closest("a[href], button, [role=button], summary, [data-track]");
  if (!el || el.closest("[data-no-track]") || QUIET.test(location.pathname)) return;
  let href = null;
  if (el.tagName === "A") {
    try {
      const u = new URL(el.href, location.href);
      href = u.origin === location.origin ? u.pathname + u.hash : u.hostname.replace(/^www\./, "");
    } catch {
      // Not a real link.
    }
  }
  track("Click", { label: clickLabel(el) || el.tagName.toLowerCase(), ...(href ? { href } : {}) });
}

// One page view per path, including ones changed without a reload (the 3D
// models page opens each model with history.pushState).
let lastPath = null;
function pageView() {
  if (location.pathname === lastPath) return;
  lastPath = location.pathname;
  if (!QUIET.test(location.pathname)) track("Page view", landing() ? { landing: true } : {});
}

let started = false;
export function Analytics() {
  useEffect(() => {
    if (!started) {
      started = true;
      pageView();
      document.addEventListener("click", onClick, { capture: true, passive: true });
      for (const fn of ["pushState", "replaceState"]) {
        const orig = history[fn];
        history[fn] = function (...args) {
          const out = orig.apply(this, args);
          pageView();
          return out;
        };
      }
      addEventListener("popstate", pageView);
    }
    if (!TOKEN || document.querySelector("script[data-cf-beacon]")) return;
    const s = document.createElement("script");
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.setAttribute("data-cf-beacon", JSON.stringify({ token: TOKEN }));
    document.head.appendChild(s);
  }, []);
  return null;
}

// The first page of a visit (this tab), so visits can be told from page views.
function landing() {
  try {
    if (sessionStorage.getItem("visit-landed")) return false;
    sessionStorage.setItem("visit-landed", "1");
    return true;
  } catch {
    return true;
  }
}

// With consent only: a random id for this browser (kept), and one for this
// visit (this tab). Declining later forgets the browser's id.
const newId = () => crypto.getRandomValues(new Uint32Array(3)).reduce((s, n) => s + n.toString(36), "").padEnd(12, "0").slice(0, 24);
function ids() {
  if (!hasConsent()) return {};
  try {
    let visitor = localStorage.getItem("py-visitor");
    if (!visitor) localStorage.setItem("py-visitor", (visitor = newId()));
    let visit = sessionStorage.getItem("py-visit");
    if (!visit) sessionStorage.setItem("py-visit", (visit = newId()));
    return { visitor, visit };
  } catch {
    return {};
  }
}
if (typeof window !== "undefined") {
  onConsentChange((value) => {
    if (value !== "declined") return;
    try {
      localStorage.removeItem("py-visitor");
      sessionStorage.removeItem("py-visit");
    } catch {
      // Storage blocked: nothing was kept.
    }
  });
}

export function SpeedInsights() {
  return null;
}

// Where this visit came from, worked out once per visit (tab) from
// ?utm_source= or the referring site.
const SOURCES = [
  [/youtube\.|youtu\.be/, "youtube"],
  [/google\./, "google"],
  [/facebook\.|fb\.|messenger\./, "facebook"],
  [/instagram\./, "instagram"],
  [/linkedin\.|lnkd\.in/, "linkedin"],
  [/reddit\./, "reddit"],
  [/bing\.|duckduckgo\.|yahoo\./, "search"],
];
function source() {
  try {
    const saved = sessionStorage.getItem("visit-source");
    if (saved) return saved;
    const utm = new URLSearchParams(location.search).get("utm_source");
    let ref = "";
    try {
      ref = new URL(document.referrer).hostname;
    } catch {
      // No referrer: typed in, a bookmark, or an app that hides it.
    }
    const found =
      utm?.toLowerCase().slice(0, 40) ||
      (ref && ref !== location.hostname ? SOURCES.find(([re]) => re.test(ref))?.[1] || ref.replace(/^www\./, "") : "direct");
    sessionStorage.setItem("visit-source", found);
    return found;
  } catch {
    return "unknown";
  }
}
// Set on the first page of the visit, before a click to another page of the
// site replaces the referrer with our own.
if (typeof window !== "undefined") source();

export function track(name, props = {}) {
  try {
    const body = JSON.stringify({ name, page: location.pathname, source: source(), detail: props, ...ids() });
    if (!navigator.sendBeacon?.("/api/event", new Blob([body], { type: "application/json" }))) {
      fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Analytics never gets in the way of the page.
  }
}

export function inject() {}
