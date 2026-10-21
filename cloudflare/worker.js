// The Cloudflare entry point for printyours: the same site and the same api/
// functions that run on Vercel, served by one Worker.
//
//   /api/<name> for a file in api/   -> that file, run through node-adapter.js
//   /api/quote-upload                -> cloudflare/quote-upload.js (R2 upload)
//   /api/sticker-ai                  -> cloudflare/sticker-ai.js (AI sticker art)
//   any other /api/...               -> the store backend on thomasverigin.ca,
//                                       as vercel.json's catch-all rewrite does
//   everything else                  -> the built site in dist/ (static assets;
//                                       wrangler.jsonc only sends /api/* here)
//
// Nothing in api/ or vercel.json changes, so the Vercel deployment keeps
// working side by side with this one.
import { toNode } from "./node-adapter.js";
import quoteUpload from "./quote-upload.js";
import stickerAi from "./sticker-ai.js";
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

const routes = {
  "quote-upload": quoteUpload,
  "sticker-ai": stickerAi,
  "quote-confirm": toNode(quoteConfirm),
  "sticker-checkout": toNode(stickerCheckout),
  "sticker-confirm": toNode(stickerConfirm),
  "sticker-file": toNode(stickerFile),
  "sticker-request": toNode(stickerRequest),
  "sticker-upload": toNode(stickerUpload),
};

function proxyToStore(request, url) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  const hasBody = !["GET", "HEAD"].includes(request.method);
  return fetch(`${STORE_API}${url.pathname.slice("/api".length)}${url.search}`, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: "manual",
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    // What the api/ files read through process.env and @vercel/blob.
    globalThis.__PRINTYOURS_R2 = env.UPLOADS;
    process.env.VERCEL_ENV = PRODUCTION_HOSTS.has(url.hostname) ? "production" : "preview";

    const route = routes[url.pathname.slice("/api/".length)];
    if (route) return route(request, env);
    return proxyToStore(request, url);
  },
};
