// Shipping for quote requests: what the finished parts come to as a package,
// and what each way of sending it costs and how long it takes. A guide on
// the form, never binding. Prices in site.config.js (quoteShipping); zones and
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

  // Box: the biggest part with padding round it, and room for all the
  // parts' own boxes with some slack for packing (mm³).
  const volume = parts.reduce((s, p) => s + p.d[0] * p.d[1] * p.d[2] * p.qty, 0) * 1.4;
  const box = { mm: [long + 2 * pad, mid + 2 * pad, thin + 2 * pad], volume, grams: grams + cfg.packing.boxGrams };
  return { flat, box };
}

// Without a model: its rough weight from its size (mm) and material.
export function guessGrams(size, qty, material) {
  const density = (estimateConfig.materials[material] || estimateConfig.materials[estimateConfig.defaultMaterial]).density;
  return (size[0] * size[1] * size[2] / 1000) * density * cfg.solidGuess * qty;
}

// Business days in the mail to `zone` (all of Canada without one). `days`
// is a stickers.delivery key, or days by zone.
function transit(daysLike, zone) {
  const days = typeof daysLike === "string" ? daysOf(daysLike) : daysLike;
  const spans = zone ? [days[zone.key]] : Object.values(days);
  return [Math.min(...spans.map((s) => s[0])), Math.max(...spans.map((s) => s[1]))];
}

// The smallest flat rate box the packed parts fit in: the biggest part any
// way round, and all of them by volume.
function boxFor(box) {
  const need = [...box.mm].sort((a, b) => b - a);
  return cfg.boxes.sizes.find((b) => {
    const has = [...b.mm].sort((x, y) => y - x);
    return need.every((v, i) => v <= has[i]) && box.volume <= has[0] * has[1] * has[2];
  });
}

// The ways to send a package to `postal` (blank: prices "from", days for
// anywhere in Canada): [{ key, name, tracked, price, low, from, days, ok, why }].
// `low` is set when the price is a range, low to `price`.
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
  const reg = cfg.regular;
  const cm3 = Math.max(pkg.box.mm[0] * pkg.box.mm[1] * pkg.box.mm[2], pkg.box.volume) / 1000;
  const billed = Math.max(pkg.box.grams, (cm3 / reg.divisor) * 1000);
  const regRate = reg.rates.find(([g]) => billed <= g);
  out.push({
    key: "regular",
    name: "Regular Parcel, tracked",
    tracked: true,
    price: regRate ? regRate[2] : null,
    low: regRate ? regRate[1] : null,
    from: false,
    days: transit(reg.days, zone),
    ok: Boolean(regRate),
    why: regRate ? "" : "too heavy for this guide: I'll quote shipping with your order",
  });
  const fit = boxFor(pkg.box);
  const heavy = pkg.box.grams > cfg.boxes.maxGrams;
  out.push({
    key: "parcel",
    name: fit && !heavy ? `Tracked, flat rate box (${fit.name})` : "Tracked, flat rate box",
    tracked: true,
    price: fit ? fit.price : null,
    from: false,
    days: transit(cfg.boxes.daysLike, zone),
    ok: Boolean(fit) && !heavy,
    why: heavy
      ? "too heavy for a flat rate box: I'll quote shipping with your order"
      : fit
        ? ""
        : "too big for a flat rate box: I'll quote shipping with your order",
  });
  return { zone, options: out };
}
