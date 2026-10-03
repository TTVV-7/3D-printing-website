// Builds the <head> tags, JSON-LD and sitemap for every page. Runs only at
// build time (and in the dev server), never in the browser bundle.
import { site, faqs } from "../site.config.js";
import { pages } from "./pages.js";

const url = site.url.replace(/\/$/, "");
const sameAs = Object.values(site.social).filter(Boolean);
const businessId = `${url}/#business`;

export const routes = ["/", ...pages.map((p) => `/${p.slug}`)];

const esc = (s) =>
  String(s).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const faqSchema = (items) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
});

const business = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": businessId,
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
    ...site.localArea.map((name) => ({ "@type": "City", name })),
    { "@type": "Country", name: "Canada" },
    ...(site.shipsTo.includes("US") ? [{ "@type": "Country", name: "United States" }] : []),
  ],
  knowsAbout: ["3D printing", "Rapid prototyping", "Replacement parts", "FDM printing", "CAD design", "Topographic maps"],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "3D printing services",
    itemListElement: pages.map((p) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: p.nav, url: `${url}/${p.slug}` },
    })),
  },
  ...(sameAs.length && { sameAs }),
};

function meta(route) {
  if (route === "/") {
    return {
      title: site.title,
      description: site.description,
      canonical: `${url}/`,
      image: `${url}/og-image.jpg`,
      preload: "/work/downtown-vancouver.webp",
      schema: [business, faqSchema(faqs)],
    };
  }
  const page = pages.find((p) => `/${p.slug}` === route);
  const canonical = `${url}/${page.slug}`;
  return {
    title: page.title,
    description: page.description,
    canonical,
    image: page.photo ? url + page.photo : `${url}/og-image.jpg`,
    preload: page.photo,
    schema: [
      business,
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: page.h1,
        serviceType: page.nav,
        description: page.description,
        url: canonical,
        provider: { "@id": businessId },
        areaServed: business.areaServed,
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${url}/` },
          { "@type": "ListItem", position: 2, name: page.nav, item: canonical },
        ],
      },
      faqSchema(page.faqs),
    ],
  };
}

// Everything per-page in <head>. Wrapped in markers so the prerender step can
// swap it out for each route.
export function headFor(route) {
  const m = meta(route);
  const t = esc(m.title);
  const d = esc(m.description);
  return [
    "<!--head-->",
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${m.canonical}" />`,
    `<meta property="og:url" content="${m.canonical}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${m.image}" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${m.image}" />`,
    m.preload && `<link rel="preload" as="image" href="${m.preload}" />`,
    `<script type="application/ld+json">${JSON.stringify(m.schema).replaceAll("<", "\\u003c")}</script>`,
    "<!--/head-->",
  ]
    .filter(Boolean)
    .join("\n    ");
}

export function sitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const entries = routes.map(
    (r) =>
      `  <url><loc>${r === "/" ? `${url}/` : url + r}</loc><lastmod>${today}</lastmod>` +
      `<priority>${r === "/" ? "1.0" : "0.8"}</priority></url>`,
  );
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`
  );
}

export const robots = () => `User-agent: *\nAllow: /\n\nSitemap: ${url}/sitemap.xml\n`;
