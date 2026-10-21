// Ready-made starting points for the thermal maker, opened from other pages
// with /stickers/?preset=<key> (the /bike page links to these). Each sets the
// label and its background, and puts in text to change; anything can still
// be changed after. Text sizes follow thermal.js: `size` is the cap height
// as a share of the label's width, x and y are from its centre.
const text = (t) => ({ kind: "text", x: 0, y: 0, scale: 1, rot: 0, style: "solid", weight: 400, ...t });

export const PRESETS = {
  "frame-name": {
    name: "Frame name decal",
    design: { sizeKey: "4x2in", pattern: "none", ring: "none" },
    layers: [text({ text: "YOUR NAME", font: "Bungee", size: 0.11 })],
  },
  trail: {
    name: "Trail sticker",
    design: { sizeKey: "round-3in", pattern: "topo", patternSeed: 12, ring: "pine" },
    layers: [text({ text: "YOUR\nTRAIL", font: "Bebas Neue", size: 0.17, style: "cutout" })],
  },
  ice: {
    name: "Emergency ID",
    design: { sizeKey: "60x40", pattern: "none", ring: "none" },
    layers: [
      text({ text: "IN CASE OF EMERGENCY", font: "Space Grotesk", weight: 700, size: 0.055, y: -0.2 }),
      text({ text: "Your Name", font: "Space Grotesk", weight: 700, size: 0.09, y: 0 }),
      text({ text: "604-555-0123", font: "Space Grotesk", weight: 700, size: 0.075, y: 0.19 }),
    ],
  },
};

export const presetOf = (key) => (Object.hasOwn(PRESETS, key) ? PRESETS[key] : null);
