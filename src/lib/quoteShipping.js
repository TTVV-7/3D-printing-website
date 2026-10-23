// Shipping for quote requests: what the finished parts come to as a package,
// and what each way of sending it costs and how long it takes. A guide on
// the form, never binding. Rates in site.config.js (quoteShipping); zones and
// days in the mail are the stickers' (src/stickers/shipping.js).
import { estimate as estimateConfig, quoteShipping as cfg, stickers } from "../../site.config.js";
import { zoneOf } from "../stickers/shipping.js";

export { zoneOf };

const daysOf = (key) => stickers.delivery.find((d) => d.key === key).days;

// The parts as a package. `items` are { size: [x, y, z] mm, qty }; `grams`
// is what they weigh altogether. Returns the flattest packing (for an
// envelope: everything side by side, stacked only if it must be) and a box.
export function packageOf(items, grams) {
  const pad = cfg.packing.padMm;
  const parts = items.map(({ size, qty }) => ({ d: [...size].sort((a, b) => b - a), qty: Math.max(1, qty) }));
  const long = Math.max(...parts.map((p) => p.d[0]));
  const mid = Math.max(...parts.map((p) => p.d[1]));
  const thin = Math.max(...parts.map((p) => p.d[2]));

  // Envelope: laid flat, a few mm apart; as many layers as the area needs.
  const [eL, eW, eT] = cfg.envelope.maxMm;
  const area = parts.reduce((s, p) => s + (p.d[0] + 5) * (p.d[1] + 5) * p.qty, 0);
  const layers = Math.max(1, Math.ceil(area / ((eL - 2 * pad) * (eW - 2 * pad))));
  const flat = { mm: [long + 2 * pad, mid + 2 * pad, layers * thin + 6], grams: grams + cfg.packing.envelopeGrams };
  flat.fits =
    flat.mm[0] <= eL && flat.mm[1] <= eW && flat.mm[2] <= eT && flat.grams <= cfg.envelope.maxGrams;
  flat.why = flat.fits
    ? ""
    : flat.mm[2] > eT
      ? `too thick for an envelope: about ${(flat.mm[2] / 10).toFixed(1)} cm packed, the most is ${eT / 10} cm`
      : flat.grams > cfg.envelope.maxGrams
        ? `too heavy for an envelope (about ${Math.round(flat.grams)} g)`
        : "too big for an envelope";

  // Box: the parts' own boxes, with some slack for packing, at least as big
  // as the biggest part.
  const volume = parts.reduce((s, p) => s + p.d[0] * p.d[1] * p.d[2] * p.qty, 0) * 1.4;
  const high = Math.max(thin, volume / (long * mid));
  const box = { mm: [long + 2 * pad, mid + 2 * pad, high + 2 * pad], grams: grams + cfg.packing.boxGrams };
  return { flat, box };
}

// Without a model: its rough weight from its size (mm) and material.
export function guessGrams(size, qty, material) {
  const density = (estimateConfig.materials[material] || estimateConfig.materials[estimateConfig.defaultMaterial]).density;
  return (size[0] * size[1] * size[2] / 1000) * density * cfg.solidGuess * qty;
}

// Business days in the mail to `zone` (all of Canada without one).
function transit(daysLike, zone) {
  const days = daysOf(daysLike);
  const spans = zone ? [days[zone.key]] : Object.values(days);
  return [Math.min(...spans.map((s) => s[0])), Math.max(...spans.map((s) => s[1]))];
}

function parcelPrice(box, zone) {
  const kg = Math.max(box.grams / 1000, (box.mm[0] * box.mm[1] * box.mm[2]) / 1000 / cfg.parcel.dimDivisor);
  const at = (z) => cfg.parcel.base[z] + Math.max(0, Math.ceil(kg) - 1) * cfg.parcel.perKg[z];
  return { kg, price: zone ? at(zone.key) : Math.min(...Object.keys(cfg.parcel.base).map(at)) };
}

// The ways to send a package to `postal` (blank: prices "from", days for
// anywhere in Canada): [{ key, name, tracked, price, from, days, ok, why }].
export function shippingOptions(pkg, postal) {
  const zone = zoneOf(postal);
  const out = [];
  const env = cfg.envelope;
  const rate = env.rates.find(([g]) => pkg.flat.grams <= g);
  out.push({
    key: "envelope",
    name: "Envelope, untracked",
    tracked: false,
    price: rate ? rate[1] : null,
    from: false,
    days: transit(env.daysLike, zone),
    ok: pkg.flat.fits && Boolean(rate),
    why: pkg.flat.why,
  });
  const { kg, price } = parcelPrice(pkg.box, zone);
  out.push({
    key: "parcel",
    name: "Tracked parcel",
    tracked: true,
    price,
    from: !zone,
    days: transit(cfg.parcel.daysLike, zone),
    ok: kg <= cfg.parcel.maxKg,
    why: kg > cfg.parcel.maxKg ? "too heavy to post: I'll arrange delivery with you" : "",
  });
  return { zone, options: out };
}
