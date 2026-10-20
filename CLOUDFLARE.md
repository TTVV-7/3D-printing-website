# Running printyours on Cloudflare

The site can deploy to Cloudflare Workers as well as Vercel, from the same
code. Nothing Vercel uses changed: `api/`, `vercel.json` and `npm run build`
are as they were, so the Vercel deployment keeps working alongside.

## How it fits together

| Vercel | Cloudflare |
| --- | --- |
| `api/*.js` functions | The same files, run by `cloudflare/worker.js` through a small (req, res) adapter (`cloudflare/node-adapter.js`) |
| Vercel Blob (sticker files, quote attachments) | R2 bucket `printyours-uploads`, bound as `UPLOADS`. `@vercel/blob` is aliased to `cloudflare/blob-r2.js` when the Worker is bundled |
| Quote uploads go browser → Blob with a presigned token | Browser → `PUT /api/quote-upload` → R2 (`cloudflare/quote-upload.js`); the Cloudflare build swaps the browser client to match |
| `vercel.json` rewrite of other `/api/*` to thomasverigin.ca | Same forwarding, done in the Worker |
| `vercel.json` cache headers | `dist/_headers`, written by `build:cf` |
| Vercel Analytics + Speed Insights | Cloudflare Web Analytics (optional token, below); custom `track()` events are dropped |
| `VERCEL_ENV=production` picks the live Stripe key | Set per request: live key only on printyours.ca / www.printyours.ca, test key on every other host |

## Scripts

- `npm run build:cf` builds `dist/` for Cloudflare (sets `CF_BUILD=1`).
- `npm run dev:cf` builds, then runs the Worker locally with a simulated R2 bucket.
- `npm run deploy:cf` builds and deploys with wrangler.

## One-time setup

1. **R2 bucket**: `printyours-uploads` already exists in the Cloudflare account.
2. **Connect the repo**: Cloudflare dashboard → Workers & Pages → Create →
   Import a repository → this repo. Build command `npm run build:cf`, deploy
   command `npx wrangler deploy`. Pick this branch for now so `main` keeps
   deploying only to Vercel.
3. **Secrets** (Worker → Settings → Variables and Secrets), same values as on Vercel:
   - `STRIPE` (test key) and `STRIPE_PRODUCTION` (live key), or `STRIPE_SECRET_KEY`
   - `RESEND_API_KEY`
   - `MAIL_FROM` if it's set on Vercel
4. **Analytics (optional)**: Cloudflare → Analytics & Logs → Web Analytics →
   add the site, copy the token, and add it as a *build* variable
   `VITE_CF_ANALYTICS_TOKEN`.
5. **Test on the workers.dev URL first**: a test-mode sticker checkout, a
   quote with an attachment, and a friends & family request. That host always
   uses the Stripe test key.
6. **Switch the domain** only once that's all good: Worker → Settings →
   Domains & Routes → add printyours.ca and www.printyours.ca. Remove them
   from the Vercel project at the same time. Switching back is the reverse.

## Not carried over

- Files uploaded before the switch stay in Vercel Blob. Their links in old
  order emails point at `/api/sticker-file`, which on Cloudflare reads R2, so
  open old ones from the Vercel deployment URL (or copy them across).
- Vercel Analytics history and the "Quote submitted" event.
- The store backend on thomasverigin.ca (print requests, admin panel) is a
  separate Vercel project and is untouched by this.
