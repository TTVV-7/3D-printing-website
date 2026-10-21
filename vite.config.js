import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { site } from "./site.config.js";

// Quote requests, uploads and portfolio data are served by the existing store
// backend (filament-shopping). In production vercel.json proxies /api there;
// this does the same for `npm run dev`.
const API_ORIGIN = "https://thomasverigin.ca";
const API_PREFIX = "/3Dprintingstore";

// `npm run build:cf` sets CF_BUILD for the Cloudflare deployment: the browser
// gets Cloudflare stand-ins for Vercel's Blob upload client and analytics
// (see cloudflare/client/). The Vercel build is unaffected.
const cloudflare = Boolean(process.env.CF_BUILD);
const cfClient = (file) => fileURLToPath(new URL(`./cloudflare/client/${file}`, import.meta.url));
const cloudflareAliases = cloudflare
  ? [
      { find: /^@vercel\/blob\/client$/, replacement: cfClient("blob-upload.js") },
      { find: /^@vercel\/analytics(\/react)?$/, replacement: cfClient("analytics.js") },
      { find: /^@vercel\/speed-insights\/react$/, replacement: cfClient("analytics.js") },
    ]
  : [];

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
          "<!--SITE_VERIFICATION-->",
          site.googleSiteVerification
            ? `<meta name="google-site-verification" content="${site.googleSiteVerification}" />`
            : "",
        )
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
          `  <url><loc>${url}/stickers/</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n` +
          `</urlset>\n`,
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), seo()],
  resolve: { alias: cloudflareAliases },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        stickers: fileURLToPath(new URL("./stickers/index.html", import.meta.url)),
      },
    },
  },
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
