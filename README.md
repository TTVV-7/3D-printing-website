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
| Business name, description, email, social links | `site.config.js` |
| FAQ (also published to Google as structured data) | `site.config.js` |
| Generator app link ("Design your own") | `site.config.js` → `designerUrl` |
| Generator cards | `src/components/Designer.jsx` + `public/designer/` |
| Portfolio photos | `public/work/` + `src/work.js` |
| Specs & materials (confirm before launch) | `src/components/Materials.jsx` |
| Link-preview image (1200×630) | `public/og-image.jpg` |

## SEO / sharing

- Title, description, Open Graph and Twitter card tags in `index.html`
- `LocalBusiness` and `FAQPage` JSON-LD, generated at build time from `site.config.js`
- `robots.txt` and `sitemap.xml` generated at build time
- The page is prerendered at build time (`scripts/prerender.js`), so crawlers get the
  full text in the HTML instead of an empty `<div id="root">`

## Stats

Vercel Web Analytics (`<Analytics />` in `App.jsx`) records visitors, top pages and
referrers. Turn it on once in the Vercel dashboard: project → Analytics → Enable.
Each successful quote also sends a `Quote submitted` event (material, quantity, whether
files/link were attached; no names or emails), visible under Analytics → Events.

All absolute URLs default to `https://printyours.ca`; set the `SITE_URL` env var to
override (e.g. for a staging domain).
