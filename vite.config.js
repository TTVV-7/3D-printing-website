import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { site, reviews, pricing, stickers } from "./site.config.js";
import { models } from "./src/models/catalog.js";

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
    knowsAbout: ["3D printing", "Rapid prototyping", "Replacement parts", "FDM printing", "CAD design", "Custom stickers"],
    ...(sameAs.length && { sameAs }),
    priceRange: "$$",
    // The "Services & pricing" cards, so Google can show what's offered and
    // from what price. A price is only given where the card states one.
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "3D printing services",
      itemListElement: pricing.services.map((s) => {
        const from = /^(from )?\$(\d+(?:\.\d+)?)$/.exec(s.price);
        return {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s.title, description: s.body },
          ...(from && {
            priceSpecification: {
              "@type": "PriceSpecification",
              priceCurrency: "CAD",
              ...(from[1] ? { minPrice: Number(from[2]) } : { price: Number(from[2]) }),
            },
          }),
        };
      }),
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${url}/#website`,
    name: site.name,
    url: `${url}/`,
    publisher: { "@id": `${url}/#business` },
  },
];

// The most one sticker of this size can cost: one alone, chrome only where
// chrome is sold in that size (src/stickers/pricing.js has the same rules).
function stickerTopPrice(z) {
  const sold = (c) => !c.sizes || c.sizes.includes(z.key) || c.sizes.includes(z.group);
  const chrome = stickers.finishes.some((f) => f.key === "chrome" && f.colours.some(sold));
  const { perSqIn, minEach, chromeExtra } = stickers.pricing;
  return Math.max(minEach, (z.w / 25.4) * (z.h / 25.4) * perSqIn) + (chrome ? chromeExtra : 0);
}

// Home > page, for the pages under it.
const breadcrumbs = (name, path) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: site.name, item: `${url}/` },
    { "@type": "ListItem", position: 2, name, item: `${url}${path}` },
  ],
});

// Search-engine details for each page, by its path. Model pages add their
// own (scripts/model-pages.js).
const pageData = {
  "/index.html": structuredData,
  "/stickers/index.html": [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Custom stickers",
      description:
        "Custom die-cut stickers from your own image or text, thermal printed in Vancouver. Pick a label, size and border and see it to scale before you order.",
      image: `${url}/stickers/sample.png`,
      brand: { "@type": "Brand", name: site.name },
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "CAD",
        lowPrice: Number((stickers.pricing.minEach * (1 - Math.max(...stickers.pricing.breaks.map((b) => b.off)))).toFixed(2)),
        highPrice: Number(Math.max(...stickers.sizes.map(stickerTopPrice)).toFixed(2)),
        offerCount: stickers.sizes.length,
        availability: "https://schema.org/InStock",
        seller: { "@id": `${url}/#business` },
      },
    },
    breadcrumbs("Custom stickers", "/stickers/"),
  ],
  "/bike/index.html": [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Bike stickers and 3D-printed bike parts",
      description:
        "Frame name decals, trail stickers and club and team logos, printed in Vancouver with no minimums, plus 3D-printed race plates, mounts and small replacement parts.",
      provider: { "@id": `${url}/#business` },
      areaServed: { "@type": "Country", name: "Canada" },
      url: `${url}/bike/`,
    },
    breadcrumbs("Bike stickers and parts", "/bike/"),
  ],
  "/models/index.html": [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "3D models designed in Vancouver",
      url: `${url}/models/`,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: models
          .filter((m) => m.show)
          .map((m, i) => ({ "@type": "ListItem", position: i + 1, name: `${m.name} (${m.collection})`, url: `${url}/models/${m.id}/` })),
      },
    },
    breadcrumbs("3D models", "/models/"),
  ],
};
const ldJson = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

// The last commit's date for the sitemap (today if git isn't available).
const lastmod = (() => {
  try {
    return execSync("git log -1 --format=%cs", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
  } catch {
    return null;
  }
})() || new Date().toISOString().slice(0, 10);

// Fills %SITE_*% placeholders in index.html and emits robots.txt + sitemap.xml
// with the right absolute URLs for whichever domain the build targets.
function seo() {
  return {
    name: "site-seo",
    // "pre" so placeholders are filled before Vite parses the URLs in <link> tags.
    transformIndexHtml: {
      order: "pre",
      handler: (html, ctx) => html
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
        .replace("<!--STRUCTURED_DATA-->", "")
        .replace("</head>", pageData[ctx.path] ? `  ${ldJson(pageData[ctx.path])}\n  </head>` : "</head>"),
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\nAllow: /api/model-file\nDisallow: /api/\nDisallow: /account/\n\nSitemap: ${url}/sitemap.xml\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source:
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          `  <url><loc>${url}/</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n` +
          `  <url><loc>${url}/stickers/</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n` +
          `  <url><loc>${url}/bike/</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n` +
          `  <url><loc>${url}/models/</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n` +
          models
            .filter((m) => m.show)
            .map((m) => `  <url><loc>${url}/models/${m.id}/</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`)
            .join("") +
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
  resolve: { alias: cloudflareAliases },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        stickers: fileURLToPath(new URL("./stickers/index.html", import.meta.url)),
        bike: fileURLToPath(new URL("./bike/index.html", import.meta.url)),
        models: fileURLToPath(new URL("./models/index.html", import.meta.url)),
        account: fileURLToPath(new URL("./account/index.html", import.meta.url)),
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
