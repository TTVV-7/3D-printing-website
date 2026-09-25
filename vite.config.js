import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { site, faqs } from "./site.config.js";

// Quote requests, uploads and portfolio data are served by the existing store
// backend (filament-shopping). In production vercel.json proxies /api there;
// this does the same for `npm run dev`.
const API_ORIGIN = "https://thomasverigin.ca";
const API_PREFIX = "/3Dprintingstore";

const url = site.url.replace(/\/$/, "");
const sameAs = Object.values(site.social).filter(Boolean);

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
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
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
