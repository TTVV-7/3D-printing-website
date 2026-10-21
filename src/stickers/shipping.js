// Delivery estimates for sticker orders: when an order should arrive, and
// whether it's light and thin enough for an envelope. Shared by the page and
// api/_sticker-order.js, so the server refuses what the page won't offer.
// Rules and numbers are in site.config.js (`delivery` and `shipping`).
import { stickers } from "../../site.config.js";
import { sizeOf, isColour } from "./pricing.js";

const { shipping } = stickers;

// The zone a postal code is in, or null until it's a whole, valid one.
export function zoneOf(postal) {
  const code = String(postal || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(code)) return null;
  return shipping.zones.find((z) => z.starts.some((s) => code.startsWith(s))) || null;
}

// What an order weighs (g) and how thick its envelope is (mm). `pieces` are
// { w, h, qty, colour } with w × h in mm.
export function parcelOf(pieces) {
  const { envelope } = shipping;
  let grams = envelope.grams;
  let layers = 0;
  for (const p of pieces) {
    const stock = p.colour ? shipping.vinyl : shipping.label;
    const sqCm = (p.w * p.h * p.qty) / 100;
    grams += sqCm * stock.gPerSqCm;
    layers += (sqCm / envelope.sqCm) * stock.mm;
  }
  return { grams, mm: envelope.mm + layers };
}

// A cart line as a parcel piece.
export const pieceOf = (it) =>
  isColour(it) ? { w: it.w, h: it.h, qty: it.qty, colour: true } : { ...sizeOf(it.sizeKey), qty: it.qty, colour: false };

// Can this order go this way?
export function fits(delivery, parcel) {
  const { limit } = delivery;
  return !limit || (parcel.grams <= limit.grams && parcel.mm <= limit.mm);
}

// `from` plus n business days (Monday to Friday).
function addBusinessDays(from, n) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  // An order on a weekend starts on Monday.
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  for (let left = n; left > 0; ) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d;
}

// The earliest and latest dates an order placed `now` is ready for pickup or
// arrives by this delivery. With no zone, the range covers all of Canada.
export function arrival(delivery, zone, now = new Date()) {
  const [p0, p1] = shipping.printDays;
  if (!delivery.days) return [addBusinessDays(now, p0), addBusinessDays(now, p1)];
  const spans = zone ? [delivery.days[zone.key]] : Object.values(delivery.days);
  const t0 = Math.min(...spans.map((s) => s[0]));
  const t1 = Math.max(...spans.map((s) => s[1]));
  return [addBusinessDays(now, p0 + t0), addBusinessDays(now, p1 + t1)];
}

// "Oct 28–31", "Oct 30 – Nov 3", or "Oct 28".
export function dateRange([a, b]) {
  const day = (d, month) => d.toLocaleDateString("en-CA", month ? { month: "short", day: "numeric" } : { day: "numeric" });
  if (a.getTime() === b.getTime()) return day(a, true);
  if (a.getMonth() === b.getMonth()) return `${day(a, true)}–${day(b)}`;
  return `${day(a, true)} – ${day(b, true)}`;
}
