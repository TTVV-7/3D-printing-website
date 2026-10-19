// Shared by the page and the api/ functions, so what Stripe charges is worked
// out on the server from the same rules the page shows.
import { stickers } from "../../site.config.js";
import { RING_GROUPS } from "./library.js";

export const ringName = (key) => RING_GROUPS.flatMap(([, r]) => r).find(([k]) => k === key)?.[1];

export const finishOf = (key) => stickers.finishes.find((f) => f.key === key);
export const colourOf = (finish, key) => finish?.colours.find((c) => c.key === key);
// "Yellow matte", or just "Chrome silver" when a finish comes in one colour.
export const labelName = (finish, colour) =>
  finish.colours.length > 1 ? `${colour.name} ${finish.name.toLowerCase()}` : finish.name;
export const sizeOf = (key) => stickers.sizes.find((s) => s.key === key);

// Is this label colour sold in this size? (site.config.js: `sizes`)
export function onSize(colour, sizeKey) {
  return !colour.sizes || colour.sizes.includes(sizeKey) || colour.sizes.includes(sizeOf(sizeKey)?.group);
}
// The finishes and colours on offer for a size; finishes with none drop out.
export function finishesFor(sizeKey) {
  return stickers.finishes
    .map((f) => ({ ...f, colours: f.colours.filter((c) => onSize(c, sizeKey)) }))
    .filter((f) => f.colours.length);
}
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

// Full-colour, custom-cut stickers (Cricut Print Then Cut).
export const COLOUR_SHAPES = [
  { key: "contour", name: "Die-cut", body: "Cut around your design" },
  { key: "circle", name: "Circle" },
  { key: "square", name: "Square" },
  { key: "rounded", name: "Rounded" },
];
export const colourShapeOf = (key) => COLOUR_SHAPES.find((s) => s.key === key);
export const colourFinishOf = (key) => stickers.colour.finishes.find((f) => f.key === key);

// Does a w × h mm sticker fit Print Then Cut's area, either way round?
export function colourFits(w, h) {
  const [mw, mh] = stickers.colour.maxMm;
  const min = stickers.colour.minMm;
  return Math.min(w, h) >= min && ((w <= mw && h <= mh) || (w <= mh && h <= mw));
}

// Per full-colour sticker, in CAD, for a sticker w × h mm.
export function priceColourEach({ w, h }, qty) {
  const { perSqIn, minEach, breaks } = stickers.colour.pricing;
  const each = Math.max(minEach, (w / 25.4) * (h / 25.4) * perSqIn);
  const off = breaks.filter((b) => qty >= b.qty).reduce((a, b) => Math.max(a, b.off), 0);
  // Whole cents, as Stripe charges it, so the page shows what's charged.
  return Math.round(each * (1 - off) * 100) / 100;
}

// A cart line is a thermal label (the default) or, with kind "colour", a
// full-colour sticker of its own size.
export const isColour = (it) => it.kind === "colour";
export const itemSizeName = (it) => (isColour(it) ? `${Math.round(it.w)} × ${Math.round(it.h)} mm` : sizeOf(it.sizeKey).name);

// A cart line's price, and how it reads ("White matte · Laurel ring").
export function lineTotal(it) {
  if (isColour(it)) return priceColourEach(it, it.qty) * it.qty;
  const { w, h } = sizeOf(it.sizeKey);
  return priceEach({ w, h }, it.finishKey, it.qty) * it.qty;
}
export function itemLabel(it) {
  if (isColour(it)) return `Full colour · ${colourShapeOf(it.shape)?.name || "Die-cut"} · ${colourFinishOf(it.finishKey)?.name || ""}`;
  const finish = finishOf(it.finishKey);
  const label = labelName(finish, colourOf(finish, it.colourKey));
  const ring = it.ring !== "none" && ringName(it.ring);
  return ring ? `${label} · ${ring} ring` : label;
}
