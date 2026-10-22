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
// /api/event, which keeps them in D1 (cloudflare/events.js); they show up on
// /api/stats. Each one carries where the visitor came from (YouTube, Google,
// Marketplace...), so you can see which channel brings orders.
//
// Neither sets cookies or records anything personal, so they run without
// asking (`cookieless`; ConsentAnalytics.jsx and CookieBanner.jsx read it).
import { useEffect } from "react";
import { site } from "../../site.config.js";

const TOKEN = import.meta.env.VITE_CF_ANALYTICS_TOKEN || site.analytics?.cloudflareToken;
export const cookieless = true;

export function Analytics() {
  useEffect(() => {
    if (!TOKEN || document.querySelector("script[data-cf-beacon]")) return;
    const s = document.createElement("script");
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.setAttribute("data-cf-beacon", JSON.stringify({ token: TOKEN }));
    document.head.appendChild(s);
  }, []);
  return null;
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
    const body = JSON.stringify({ name, page: location.pathname, source: source(), detail: props });
    if (!navigator.sendBeacon?.("/api/event", new Blob([body], { type: "application/json" }))) {
      fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Analytics never gets in the way of the page.
  }
}

export function inject() {}
