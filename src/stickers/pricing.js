// Shared by the page and api/sticker-checkout.js, so the price Stripe charges
// is worked out on the server from the same rules the page shows.
import { stickers } from "../../site.config.js";

// Per sticker, in CAD, for a sticker w × h mm.
export function priceEach({ w, h }, finish, qty) {
  const { perSqIn, minEach, glossyExtra, breaks } = stickers.pricing;
  let each = Math.max(minEach, (w / 25.4) * (h / 25.4) * perSqIn);
  if (finish === "glossy") each += glossyExtra;
  const off = breaks.filter((b) => qty >= b.qty).reduce((a, b) => Math.max(a, b.off), 0);
  return each * (1 - off);
}
