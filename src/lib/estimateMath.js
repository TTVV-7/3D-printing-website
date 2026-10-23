// The quote form's price maths for one part, from its measurements: kept
// apart from meshEstimate.js (which needs three.js to read model files) so
// the price chat on the server (cloudflare/price-chat.js) prices the same way.

// Grams and hours for one copy of one part.
export function partUsage(m, { material, quality }, cfg) {
  const mat = cfg.materials[material] || cfg.materials[cfg.defaultMaterial];
  const shell = Math.min(m.volume, m.area * cfg.wallMm);
  const printed = (shell + (m.volume - shell) * cfg.infill) * cfg.waste; // mm³
  const grams = (printed / 1000) * mat.density;
  const rate = cfg.gramsPerHour[quality] ?? cfg.gramsPerHour[""];
  // A little fixed time per part for heating, homing and first layer.
  const hours = grams / rate + 0.15;
  return { grams, hours, perGram: mat.perGram };
}

// Price range for one part on its own, all copies, setup included. The order
// minimum applies to the whole order only, so it isn't in here.
export function partEstimate(m, options, cfg) {
  const quantity = Math.max(1, Number(options.quantity) || 1);
  const off = cfg.bulk.find((b) => quantity >= b.min)?.off ?? 0;
  const u = partUsage(m, options, cfg);
  const each = u.grams * u.perGram + u.hours * cfg.machinePerHour;
  const total = (each * quantity + cfg.setupPerPart) * (1 - off);
  const round1 = (n) => Math.round(n * 10) / 10;
  return {
    grams: round1(u.grams * quantity),
    hours: round1(u.hours * quantity),
    low: Math.max(1, Math.floor(total * cfg.low)),
    high: Math.max(1, Math.ceil(total * cfg.high)),
  };
}
