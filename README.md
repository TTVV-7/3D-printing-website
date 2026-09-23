# MAP3D website

Standalone marketing site for MAP3D, a 3D printing service in Vancouver.
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

All absolute URLs come from the `SITE_URL` env var. Set it in Vercel once you have a
custom domain (e.g. `https://map3d.ca`); until then it falls back to the Vercel
production URL.
