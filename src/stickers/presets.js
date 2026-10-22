// Ready-made starting points for the thermal maker: the Bike tab's templates
// on /stickers, also opened with /stickers/?preset=<key>. Each sets the
// label and its background, and puts in text to change; anything can still
// be changed after. Text sizes follow thermal.js: `size` is the cap height
// as a share of the label's width, x and y are from its centre.
const text = (t) => ({ kind: "text", x: 0, y: 0, scale: 1, rot: 0, style: "solid", weight: 400, ...t });

export const PRESETS = {
  "frame-name": {
    name: "Frame name decal",
    blurb: "Your name for the top tube",
    design: { sizeKey: "50x30", pattern: "none", ring: "none" },
    layers: [text({ text: "YOUR NAME", font: "Bungee", size: 0.12 })],
  },
  trail: {
    name: "Trail sticker",
    blurb: "Your trail over topo lines",
    design: { sizeKey: "round-2in", pattern: "topo", patternSeed: 12, ring: "pine" },
    layers: [text({ text: "YOUR\nTRAIL", font: "Bebas Neue", size: 0.17, style: "cutout" })],
  },
  ice: {
    name: "Emergency ID",
    blurb: "A name and number, for the frame or helmet",
    design: { sizeKey: "50x30", pattern: "none", ring: "none" },
    layers: [
      text({ text: "IN CASE OF EMERGENCY", font: "Space Grotesk", weight: 700, size: 0.06, y: -0.18 }),
      text({ text: "Your Name", font: "Space Grotesk", weight: 700, size: 0.1, y: 0 }),
      text({ text: "604-555-0123", font: "Space Grotesk", weight: 700, size: 0.085, y: 0.17 }),
    ],
  },
};

export const presetOf = (key) => (Object.hasOwn(PRESETS, key) ? PRESETS[key] : null);
