// Gives every model shown on /models its own page, /models/<id>/: a copy of
// the built models page with that model's title, description, picture and
// search-engine details, so a link to it previews properly and Google can
// list it. The page opens the model on load (src/models/ModelsPage.jsx).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { site } from "../site.config.js";
import { models, MODELS_REPO } from "../src/models/catalog.js";

const url = site.url.replace(/\/$/, "");
const dist = new URL("../dist/models/", import.meta.url);
const template = await readFile(new URL("index.html", dist), "utf8");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const raw = (p) => `https://raw.githubusercontent.com/${MODELS_REPO}/HEAD/${p.split("/").map(encodeURIComponent).join("/")}`;
// Swaps the content of one <meta>/<link> tag, matched by its attribute.
const set = (html, attr, value) =>
  html.replace(new RegExp(`(<(?:meta|link) [^>]*${attr}[^>]*(?:content|href)=")[^"]*(")`), `$1${esc(value)}$2`);

const shown = models.filter((m) => m.show);
for (const m of shown) {
  const page = `${url}/models/${m.id}/`;
  const title = `${m.name} | ${m.collection} | Print Yours`;
  const description = `${m.name} from the ${m.collection} collection, designed in Vancouver. Turn it around in 3D and have one printed by Print Yours.`;
  const image = m.preview ? raw(m.preview) : `${url}/og-image.jpg`;

  const data = [
    {
      "@context": "https://schema.org",
      "@type": "3DModel",
      name: m.name,
      description,
      url: page,
      image,
      isPartOf: { "@type": "Collection", name: m.collection },
      creator: { "@id": `${url}/#business` },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: site.name, item: `${url}/` },
        { "@type": "ListItem", position: 2, name: "3D models", item: `${url}/models/` },
        { "@type": "ListItem", position: 3, name: m.name, item: page },
      ],
    },
    m.video && {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: `${m.name}: 3D print timelapse`,
      description,
      thumbnailUrl: `https://i.ytimg.com/vi/${m.video.id}/oar2.jpg`,
      uploadDate: m.video.date,
      embedUrl: `https://www.youtube.com/embed/${m.video.id}`,
      contentUrl: `https://www.youtube.com/shorts/${m.video.id}`,
    },
  ].filter(Boolean);

  // The models page's own details (its list and breadcrumbs) give way to this model's.
  let html = template
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "")
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  html = set(html, 'name="description"', description);
  html = set(html, 'rel="canonical"', page);
  html = set(html, 'property="og:url"', page);
  html = set(html, 'property="og:title"', title);
  html = set(html, 'name="twitter:title"', title);
  html = set(html, 'property="og:description"', description);
  html = set(html, 'name="twitter:description"', description);
  html = set(html, 'property="og:image"', image);
  html = set(html, 'name="twitter:image"', image);
  html = set(html, 'property="og:image:alt"', m.name);
  if (m.preview) html = html.replace(/\s*<meta property="og:image:(width|height)"[^>]*>/g, "");
  html = html
    .replace("</head>", `  <script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>\n  </head>`)
    .replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript>\n      <h1>${esc(m.name)}</h1>\n      <p>${esc(description)}</p>\n      <p>To order one, email <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>.</p>\n    </noscript>`);

  const dir = new URL(`${m.id}/`, dist);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL("index.html", dir), html);
}
console.log(`wrote ${shown.length} model pages`);
