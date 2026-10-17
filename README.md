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
| Prices | `site.config.js` → `pricing` |
| Reviews and Marketplace link | `site.config.js` → `reviews` |
| Generator app link ("Design your own") | `site.config.js` → `designerUrl` |
| Sticker page (/stickers): paper colours, finishes, max width, prices | `site.config.js` → `stickers`, code in `src/stickers/` |
| Generator cards | `src/components/Designer.jsx` + `public/designer/` |
| Portfolio photos | `public/work/` + `src/work.js` |
| Specs & materials (confirm before launch) | `src/components/Materials.jsx` |
| Link-preview image (1200×630) | `public/og-image.jpg` |
| Intro terrain (North Shore height map) | `node scripts/topo-heightmap.mjs` → `public/topo/` |

## SEO / sharing

- Title, description, Open Graph and Twitter card tags in `index.html`
- `LocalBusiness` JSON-LD, generated at build time from `site.config.js`
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

## Sticker payments (Stripe)

`/stickers` checks out through Stripe Checkout, no account needed:
`api/sticker-checkout.js` (a Vercel function) works out the price on the server
and sends the customer to Stripe's page. Until a key is set, the button says
payments aren't on yet, so the page is safe to share as it is.

The card is **held, not charged** (`capture_method: manual`). When an order comes
in, Stripe dashboard → Payments → the payment → **Capture** once it's printed,
or **Cancel** if you can't do it (no refund, no fee). Holds expire after 7 days.
The order's size, paper, finish and print-ready image link are in the payment's
metadata.

1. Stripe dashboard → Developers → API keys. Start with the **test** secret key
   (`sk_test_...`); pay with card `4242 4242 4242 4242`, any future date and CVC.
2. Vercel → project → Settings → Environment Variables: `STRIPE_SECRET_KEY`.
3. Optional: Vercel → Storage → create a Blob store and connect it to the project
   (adds `BLOB_READ_WRITE_TOKEN`) so each order keeps the exact image to print.
4. When ready for real money, swap in the live key (`sk_live_...`).

`npm run dev` sends `/api` to the store backend, so it can't reach this function;
use `npx vercel dev` or a preview deploy to try a payment.
