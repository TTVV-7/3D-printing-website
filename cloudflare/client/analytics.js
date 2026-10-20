// Browser stand-ins for @vercel/analytics and @vercel/speed-insights in the
// Cloudflare build (vite.config.js aliases them here when CF_BUILD is set).
// Vercel's scripts live at /_vercel/... and would only 404 off Vercel.
//
// <Analytics /> loads Cloudflare Web Analytics instead, if a site token is
// set at build time as VITE_CF_ANALYTICS_TOKEN (Cloudflare dashboard >
// Analytics & Logs > Web Analytics > add printyours.ca > copy the token).
// It's cookieless, but ConsentAnalytics.jsx still only renders this after the
// visitor accepts, same as before. Custom events (track) have no Cloudflare
// equivalent, so they're dropped.
import { useEffect } from "react";

const TOKEN = import.meta.env.VITE_CF_ANALYTICS_TOKEN;

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

export function track() {}
export function inject() {}
