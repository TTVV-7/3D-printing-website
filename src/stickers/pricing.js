// Shared by the page and the api/ functions, so what Stripe charges is worked
// out on the server from the same rules the page shows.
import { stickers } from "../../site.config.js";

export const finishOf = (key) => stickers.finishes.find((f) => f.key === key);
export const colourOf = (finish, key) => finish?.colours.find((c) => c.key === key);
// "Yellow matte", or just "Chrome silver" when a finish comes in one colour.
export const labelName = (finish, colour) =>
  finish.colours.length > 1 ? `${colour.name} ${finish.name.toLowerCase()}` : finish.name;
export const sizeOf = (key) => stickers.sizes.find((s) => s.key === key);
export const deliveryOf = (key) => stickers.delivery.find((d) => d.key === key);

// Per sticker, in CAD, for a sticker w × h mm.
export function priceEach({ w, h }, finish, qty) {
  const { perSqIn, minEach, chromeExtra, breaks } = stickers.pricing;
  let each = Math.max(minEach, (w / 25.4) * (h / 25.4) * perSqIn);
  if (finish === "chrome") each += chromeExtra;
  const off = breaks.filter((b) => qty >= b.qty).reduce((a, b) => Math.max(a, b.off), 0);
  return each * (1 - off);
}

// The delivery charge for an order whose stickers come to `subtotal`.
export function deliveryCost(d, subtotal) {
  return d.freeOver && subtotal >= d.freeOver ? 0 : d.amount;
}
