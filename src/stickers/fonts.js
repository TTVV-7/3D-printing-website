// Typefaces for text on stickers; loaded from Google Fonts in
// stickers/index.html and bike/index.html (keep FONTS_CSS there in step).
// Every one is free for commercial use (SIL Open Font License or Apache;
// all listed as such on 1001fonts.com too), so they can go on stickers we
// sell. `more` ones sit behind "More fonts" in the picker.
export const FONTS = [
  { family: "Bungee", name: "Bungee", weight: 400 },
  { family: "Space Grotesk", name: "Grotesk", weight: 700 },
  { family: "Bebas Neue", name: "Bebas", weight: 400 },
  { family: "Permanent Marker", name: "Marker", weight: 400 },
  { family: "Pacifico", name: "Script", weight: 400 },
  { family: "Special Elite", name: "Typewriter", weight: 400 },
  { family: "Bangers", name: "Bangers", weight: 400 },
  { family: "Luckiest Guy", name: "Luckiest Guy", weight: 400 },
  { family: "Anton", name: "Anton", weight: 400, more: true },
  { family: "Lobster", name: "Lobster", weight: 400, more: true },
  { family: "Righteous", name: "Righteous", weight: 400, more: true },
  { family: "Fredoka", name: "Fredoka", weight: 600, more: true },
  { family: "Titan One", name: "Titan", weight: 400, more: true },
  { family: "Alfa Slab One", name: "Slab", weight: 400, more: true },
  { family: "Russo One", name: "Russo", weight: 400, more: true },
  { family: "Black Ops One", name: "Stencil", weight: 400, more: true },
  { family: "Graduate", name: "Varsity", weight: 400, more: true },
  { family: "Racing Sans One", name: "Racing", weight: 400, more: true },
  { family: "Orbitron", name: "Orbitron", weight: 700, more: true },
  { family: "Audiowide", name: "Audiowide", weight: 400, more: true },
  { family: "Press Start 2P", name: "Pixel", weight: 400, more: true },
  { family: "Rye", name: "Western", weight: 400, more: true },
  { family: "Kaushan Script", name: "Brush script", weight: 400, more: true },
  { family: "Caveat Brush", name: "Handwritten", weight: 400, more: true },
  { family: "Shrikhand", name: "Shrikhand", weight: 400, more: true },
  { family: "Creepster", name: "Spooky", weight: 400, more: true },
];
export const fontOf = (family) => FONTS.find((f) => f.family === family) || FONTS[0];
