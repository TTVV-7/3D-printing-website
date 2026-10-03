# Print Yours website

Marketing site for Print Yours (printyours.ca), a custom 3D printing service in Vancouver.
Vite + React + Tailwind, deployed on Vercel.

```
npm install
npm run dev      # http://localhost:5173
npm run build
```

## How it fits with the store backend

Quote requests, file uploads and email notifications are still handled by the
existing store app (`filament-shopping`, live at thomasverigin.ca/3Dprintingstore).
`vercel.json` proxies `/api/*` there, and the Vite dev server does the same locally,
so new requests show up in the same admin panel as before. Nothing to migrate.

## Things to edit

| What | Where |
| --- | --- |
| Business name, title, description, email, social links, shipping area | `site.config.js` |
| Service landing pages (copy, titles, FAQs) | `src/pages.js` |
| FAQ (also published to Google as structured data) | `site.config.js` |
| Generator app link ("Design your own") | `site.config.js` → `designerUrl` |
| Generator cards | `src/components/Designer.jsx` + `public/designer/` |
| Portfolio photos | `public/work/` + `src/work.js` |
| Specs & materials (confirm before launch) | `src/components/Materials.jsx` |
| Link-preview image (1200×630) | `public/og-image.jpg` |

## SEO / sharing

- Each service in `src/pages.js` gets its own URL (e.g. `/rapid-prototyping`) aimed at
  what people search for. Add an entry and it's picked up by the sitemap, footer and
  "Other services" links automatically.
- `npm run build` pre-renders every page to real HTML (`scripts/prerender.js`), so
  search engines and link previews see the content without running JavaScript.
- Per-page title, description, canonical, Open Graph/Twitter tags and JSON-LD
  (`LocalBusiness`, `Service`, `BreadcrumbList`, `FAQPage`) come from `src/seo.js`.
- `robots.txt` and `sitemap.xml` generated at build time

All absolute URLs default to `https://printyours.ca`; set the `SITE_URL` env var to
override (e.g. for a staging domain).
