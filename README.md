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
| Reviews, Google and Marketplace links | `site.config.js` → `reviews` |
| Generator app link ("Design your own") | `site.config.js` → `designerUrl` |
| Sticker page (/stickers): paper colours, finishes, max width, prices | `site.config.js` → `stickers`, code in `src/stickers/` |
| Full-colour, custom-cut stickers (/stickers/#colour): materials, size limits, prices | `site.config.js` → `stickers.colour`, code in `src/stickers/ColourStudio.jsx` + `colour.js`, crop / auto-crop in `CropDialog.jsx` |
| Generator cards | `src/components/Designer.jsx` + `public/designer/` |
| Portfolio photos | `public/work/` + `src/work.js` |
| Specs & materials (confirm before launch) | `src/components/Materials.jsx` |
| Link-preview image (1200×630) | `public/og-image.jpg` |
| Intro terrain (North Shore height map) | `node scripts/topo-heightmap.mjs` → `public/topo/` |
| Real bike models for full-colour bike stickers | `SKETCHFAB_TOKEN=… node scripts/bike-models.mjs` → `public/models/bikes/`, tube positions and credits in `src/stickers/bikeModels.js` |
| Google Search Console verification | `site.config.js` → `googleSiteVerification` |

## Google reviews

Paste two links into `site.config.js` → `reviews`:

- `googleUrl`: your listing on Google Maps (Share → Copy link). Shows a "Reviews on Google" button.
- `googleReviewUrl`: the link from Google Business Profile → "Ask for reviews". Shows a
  "Write a review" button and a footer link, and makes `printyours.ca/review` forward
  straight to the review box (handy for receipts, packaging and QR codes).

## SEO / sharing

- Title, description, Open Graph and Twitter card tags in `index.html`
- `LocalBusiness` JSON-LD, generated at build time from `site.config.js`
- `robots.txt` and `sitemap.xml` generated at build time
- Google Search Console verification tag: `site.config.js` → `googleSiteVerification`
- Every page (home, stickers, bike, 3D models and each model page) is prerendered at
  build time (`scripts/prerender.js`), so crawlers and link previews get the full text
  instead of an empty `<div id="root">`. Anything only a browser can draw (canvas
  previews) waits for `useHydrated()` so the page hydrates without mismatches.
- Structured data per page (`pageData` in `vite.config.js`): the business with its
  services and prices, the site name, stickers as a product with a price range, the bike
  page as a service, the models list, and breadcrumbs; model pages add their own
- The sitemap carries the last commit's date; robots.txt keeps `/api/` (except the public model files) and `/account/` out

## Stats

Vercel Web Analytics (`<Analytics />` in `App.jsx`) records visitors, top pages and
referrers. Turn it on once in the Vercel dashboard: project → Analytics → Enable.
Each successful quote also sends a `Quote submitted` event (material, quantity, whether
files/link were attached; no names or emails), visible under Analytics → Events.

On the Cloudflare deployment there's more: sign in at `/account/` as an admin and
open **Stats** for charts of visits, clicks, orders, uploads, busiest hours and
places (see CLOUDFLARE.md → Analytics).

All absolute URLs default to `https://printyours.ca`; set the `SITE_URL` env var to
override (e.g. for a staging domain).

## Sticker payments (Stripe)

`/stickers` checks out through Stripe Checkout, no account needed.
`api/sticker-checkout.js` works out the price and delivery on the server and
sends the customer to Stripe's page. Until a key is set, the button says
payments aren't on yet, so the page is safe to share as it is.

The card is **held, not charged** (`capture_method: manual`). When an order comes
in, Stripe dashboard → Payments → the payment → **Capture** once it's printed,
or **Cancel** if you can't do it (no refund, no fee). Holds expire after 7 days.

**Order emails:** when the customer lands back on the page,
`api/sticker-confirm.js` checks the payment with Stripe and files the order with
the store backend, so it shows up in the admin panel and sends the usual
notification email: size, shape, label, ink settings, delivery and address,
phone, total, a link to the payment in Stripe and the print-ready PNG (uploaded
through the backend's `/api/upload`, like quote attachments). It sends once per
order. If someone closes the tab before landing back, the order is still in
Stripe; switch on Stripe → Settings → Notifications → successful payments as a
backstop.

**Customer confirmation emails:** after a quote request, a paid sticker order
or a friends & family request, the customer gets a confirmation email
(`api/_mail.js`, through [Resend](https://resend.com)). Sticker emails show
each sticker as designed, on its label colour. Quote emails show a picture of
the uploaded model (rendered in their browser), their photos, the link they
gave and their details. Replies go to `site.email`. To switch it on:

1. Sign up at resend.com, add the domain `printyours.ca` and add the DNS records
   it shows in Vercel → Domains → printyours.ca.
2. Create an API key and add it in Vercel as `RESEND_API_KEY` (optionally
   `MAIL_FROM`, default `printyours <orders@printyours.ca>`), then redeploy.

Without the key, nothing is sent and everything else works as before.

**Friends & family:** the checkout has a "Friends & family" tab that skips
payment. `api/sticker-request.js` checks the cart the same way and files it with
the same admin panel and email, marked as a request (no payment, with what it
would have cost and an optional message). Anyone can pick it, so it's a request
you decide on, not an order.

1. Stripe dashboard → Developers → API keys. Start with the **test** secret key
   (`sk_test_...`); pay with card `4242 4242 4242 4242`, any future date and CVC.
2. Vercel → project → Settings → Environment Variables: `STRIPE_SECRET_KEY`
   (or `STRIPE`). Redeploy after adding it. `STRIPE_PRODUCTION` holds the live
   key: it's used on the production site only, so previews keep the test key in
   `STRIPE`. Best as a restricted key (`rk_live_...`) with Checkout Sessions and
   PaymentIntents set to Write and nothing else.
3. When ready for real money, swap in the live key (`sk_live_...`).

Label stock, delivery options and prices are all in `site.config.js` → `stickers`.

**Full-colour, custom-cut stickers** are the second tab on `/stickers` (link
straight to it with `/stickers/#colour`). For now the tab says **Coming soon**:
people can design and preview, but can't add one to the cart, and the server
refuses them at checkout. Set `stickers.colour.available` to `true` in
`site.config.js` to start taking orders. The customer uploads any image,
picks die-cut (cut around the design), circle, square or rounded, a border,
a backing colour, a size and gloss or matte vinyl. They share the cart,
checkout, Stripe and emails with the thermal labels, and the server prices
them from their size the same way.

Each one's print file is a 300 dpi PNG whose outline is the cut line:
see-through outside, the backing colour inside. To make one, open the print
file from the order email, upload it to Cricut Design Space (it detects the
outline, so choose Print Then Cut), set the size listed in the order, print
on the inkjet and let the Cricut cut it. Sizes are capped to Print Then Cut's
6.75 × 9.25 in area (`stickers.colour.maxMm`); check that against your
machine.

**Full-colour bike stickers** are the second kind on the Bike tab
(`/stickers/#bike-colour`), marked **Coming soon** (`stickers.bikeColour.available`):
design and preview only, with no cart or checkout yet. There are two
designs: a name with a flag beside it (any country, from `country-flag-icons`)
for the top tube, and a ride's route for the down tube. The route comes from
addresses typed in, using free OpenStreetMap services that need no key:
Photon for address search and OSRM's bike router for the route
(`src/stickers/places.js`). The thermal route dialog's "From addresses" tab
uses them too. They're fine for now but have fair-use limits, so move to a
keyed service such as OpenRouteService before it gets busy. Credit for the
map data ("© OpenStreetMap contributors") is shown wherever they're used. The
preview wraps the sticker round the tube of a real-size road, mountain or
city bike model (`BikeModelScene.js`, `bikeModels.js`) in any frame colour.
The three models are CC BY 4.0 from Sketchfab and are credited on the page.

**Print files** are stored in this project's own Vercel Blob store
(`api/sticker-upload.js`). Connect one once: Vercel → printyours → Storage →
Create → Blob → connect to this project (it adds `BLOB_STORE_ID`, or on older
setups `BLOB_READ_WRITE_TOKEN`; either works), then redeploy. Until then orders still work, but their emails say the print file
wasn't uploaded.

`npm run dev` sends `/api` to the store backend, so it can't reach these
functions; use `npx vercel dev` or a preview deploy to try a payment.
