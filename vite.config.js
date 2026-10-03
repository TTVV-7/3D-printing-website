import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { headFor, routes } from "./src/seo.js";

// Quote requests, uploads and portfolio data are served by the existing store
// backend (filament-shopping). In production vercel.json proxies /api there;
// this does the same for `npm run dev`.
const API_ORIGIN = "https://thomasverigin.ca";
const API_PREFIX = "/3Dprintingstore";

// Fills the per-page <head> (title, meta, JSON-LD). For the build,
// scripts/prerender.js swaps it for each route and writes robots + sitemap.
function seo() {
  return {
    name: "site-seo",
    // "pre" so the tags are in place before Vite parses the URLs in <link> tags.
    transformIndexHtml: {
      order: "pre",
      handler: (html, ctx) => {
        const route = ctx.server ? (ctx.originalUrl || ctx.path).split(/[?#]/)[0].replace(/\/$/, "") || "/" : "/";
        return html.replace("<!--PAGE_HEAD-->", headFor(routes.includes(route) ? route : "/"));
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), seo()],
  server: {
    proxy: {
      "/api": {
        target: API_ORIGIN,
        changeOrigin: true,
        rewrite: (p) => API_PREFIX + p,
      },
    },
  },
});
