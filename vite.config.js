import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { site, reviews } from "./site.config.js";

// Quote requests, uploads and portfolio data are served by the existing store
// backend (filament-shopping). In production vercel.json proxies /api there;
// this does the same for `npm run dev`.
const API_ORIGIN = "https://thomasverigin.ca";
const API_PREFIX = "/3Dprintingstore";

const url = site.url.replace(/\/$/, "");
const sameAs = [...Object.values(site.social), reviews.googleUrl].filter(Boolean);

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${url}/#business`,
    name: site.name,
    description: site.description,
    url,
    image: `${url}/og-image.jpg`,
    logo: `${url}/logo.png`,
    ...(site.email && { email: site.email }),
    address: {
      "@type": "PostalAddress",
      addressLocality: site.city,
      addressRegion: site.region,
      addressCountry: site.country,
    },
    areaServed: [
      { "@type": "City", name: "Vancouver" },
      { "@type": "AdministrativeArea", name: "Metro Vancouver" },
      { "@type": "Country", name: "Canada" },
    ],
    knowsAbout: ["3D printing", "Rapid prototyping", "Replacement parts", "FDM printing", "CAD design"],
    ...(sameAs.length && { sameAs }),
  },
];

// Fills %SITE_*% placeholders in index.html and emits robots.txt + sitemap.xml
// with the right absolute URLs for whichever domain the build targets.
function seo() {
  return {
    name: "site-seo",
    // "pre" so placeholders are filled before Vite parses the URLs in <link> tags.
    transformIndexHtml: {
      order: "pre",
      handler: (html) => html
        .replaceAll("%SITE_URL%", url)
        .replaceAll("%SITE_TITLE%", `${site.name} | ${site.tagline}`)
        .replaceAll("%SITE_DESCRIPTION%", site.description)
        .replaceAll("%SITE_EMAIL%", site.email)
        .replace(
          "<!--STRUCTURED_DATA-->",
          `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`,
        ),
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\n\nSitemap: ${url}/sitemap.xml\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source:
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          `  <url><loc>${url}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n` +
          `</urlset>\n`,
      });
      // printyours.ca/review: a short link to the Google review box for receipts and QR codes.
      if (reviews.googleReviewUrl) {
        const to = reviews.googleReviewUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
        this.emitFile({
          type: "asset",
          fileName: "review/index.html",
          source:
            `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex">` +
            `<meta http-equiv="refresh" content="0; url=${to}">` +
            `<title>Review ${site.name}</title><a href="${to}">Leave a review for ${site.name} on Google</a>\n`,
        });
      }
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
