// The Cloudflare entry point for printyours: the same site and the same api/
// functions that run on Vercel, served by one Worker.
//
//   /api/<name> for a file in api/   -> that file, run through node-adapter.js
//   /api/quote-upload                -> cloudflare/quote-upload.js (R2 upload)
//   /api/sticker-ai                  -> cloudflare/sticker-ai.js (AI sticker art)
//   /api/event, /api/stats           -> cloudflare/events.js (site analytics)
//   /api/auth/*, /api/account/*      -> cloudflare/accounts.js (customer accounts)
//   /api/account/stats               -> cloudflare/stats.js (admin charts)
//   any other /api/...               -> the store backend on thomasverigin.ca,
//                                       as vercel.json's catch-all rewrite does
//   everything else                  -> the built site in dist/ (static assets;
//                                       wrangler.jsonc only sends /api/* here)
//
// Nothing in api/ or vercel.json changes, so the Vercel deployment keeps
// working side by side with this one.
import { AsyncLocalStorage } from "node:async_hooks";
import { toNode } from "./node-adapter.js";
import quoteUpload from "./quote-upload.js";
import stickerAi from "./sticker-ai.js";
import priceChat from "./price-chat.js";
import modelFile from "./model-file.js";
import { event, stats } from "./events.js";
import { passesTurnstile } from "./turnstile.js";
import { accountRoutes, recordOrder } from "./accounts.js";
import { adminStats } from "./stats.js";
import quoteConfirm from "../api/quote-confirm.js";
import stickerCheckout from "../api/sticker-checkout.js";
import stickerConfirm from "../api/sticker-confirm.js";
import stickerFile from "../api/sticker-file.js";
import stickerRequest from "../api/sticker-request.js";
import stickerUpload from "../api/sticker-upload.js";

const STORE_API = "https://thomasverigin.ca/3Dprintingstore/api";

// Only these hosts count as production. api/_stripe.js picks the live Stripe
// key when VERCEL_ENV is "production" and the test key otherwise, so preview
// and workers.dev URLs can never take real money, as on Vercel.
const PRODUCTION_HOSTS = new Set(["printyours.ca", "www.printyours.ca"]);

// The secrets as they're named in the Cloudflare dashboard, for the names the
// api/ files read. The api/ names win when both are set.
const SECRET_ALIASES = { RESEND_API_KEY: "ReSend", STRIPE_PRODUCTION: "Stripe_Claude" };

// On the real domain these routes take payments; without a live Stripe key
// they'd quietly fall back to the test key, so they're turned off instead.
const PAYMENT_ROUTES = new Set(["sticker-checkout", "sticker-confirm"]);
const LIVE_KEY = /^(sk|rk)_live_/;

// Routes that store files, file requests or send email without a payment:
// they need a Turnstile pass (X-Turnstile header) once TURNSTILE_SECRET is set.
const GUARDED = new Set(["quote-upload", "print-requests", "notify-request", "quote-confirm", "sticker-request", "auth/email"]);

const routes = {
  "quote-upload": quoteUpload,
  "sticker-ai": stickerAi,
  "price-chat": priceChat,
  "model-file": modelFile,
  event,
  stats,
  ...accountRoutes,
  "account/stats": adminStats,
  "quote-confirm": toNode(quoteConfirm),
  "sticker-checkout": toNode(stickerCheckout),
  "sticker-confirm": toNode(stickerConfirm),
  "sticker-file": toNode(stickerFile),
  "sticker-request": toNode(stickerRequest),
  "sticker-upload": toNode(stickerUpload),
};

function proxyToStore(request, url, body) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cookie");
  const hasBody = !["GET", "HEAD"].includes(request.method);
  return fetch(`${STORE_API}${url.pathname.slice("/api".length)}${url.search}`, {
    method: request.method,
    headers,
    body: hasBody ? (body ?? request.body) : undefined,
    redirect: "manual",
  });
}

// A quote request on its way to the store backend: once it's saved there,
// it's also recorded for the customer's account (cloudflare/accounts.js).
async function quoteRequest(request, env, url) {
  const text = await request.text();
  const res = await proxyToStore(request, url, text);
  if (res.ok) {
    try {
      await recordOrder(env, JSON.parse(text), request.cf);
    } catch {
      // Not JSON: the store backend will have said so.
    }
  }
  return res;
}

// The request being handled, for code that runs deep inside an api/ file
// (api/_sticker-order.js records orders through a global). One isolate serves
// many requests at once, so a per-request value can't sit in a global itself.
const current = new AsyncLocalStorage();

export default {
  fetch(request, env, ctx) {
    return current.run({ cf: request.cf }, () => handle(request, env, ctx));
  },
};

async function handle(request, env, ctx) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

  // What the api/ files read through process.env and @vercel/blob.
  globalThis.__PRINTYOURS_R2 = env.UPLOADS;
  // Sticker orders filed by api/_sticker-order.js go into accounts too.
  globalThis.__PRINTYOURS_RECORD = (entry) => recordOrder(env, entry, current.getStore()?.cf);
  const production = PRODUCTION_HOSTS.has(url.hostname);
  process.env.VERCEL_ENV = production ? "production" : "preview";
  for (const [name, alias] of Object.entries(SECRET_ALIASES)) {
    if (!process.env[name] && env[alias]) process.env[name] = env[alias];
  }

  const name = url.pathname.slice("/api/".length);
  if (production && PAYMENT_ROUTES.has(name) && !LIVE_KEY.test(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_PRODUCTION || "")) {
    console.error("payments: no live Stripe key (STRIPE_PRODUCTION) on the production domain");
    return Response.json({ error: "Payments are not set up yet" }, { status: 503 });
  }
  if (GUARDED.has(name) && request.method !== "GET" && !(await passesTurnstile(env, request.headers.get("x-turnstile"), request))) {
    return Response.json({ error: "Couldn't confirm you're not a bot. Refresh the page and try again." }, { status: 403 });
  }
  const route = Object.hasOwn(routes, name) ? routes[name] : null;
  if (route) return route(request, env, ctx);
  if (name === "print-requests" && request.method === "POST") return quoteRequest(request, env, url);
  return proxyToStore(request, url);
}
