// Typefaces for text on stickers; loaded in stickers/index.html.
export const FONTS = [
  { family: "Bungee", name: "Bungee", weight: 400 },
  { family: "Space Grotesk", name: "Grotesk", weight: 700 },
  { family: "Bebas Neue", name: "Bebas", weight: 400 },
  { family: "Permanent Marker", name: "Marker", weight: 400 },
  { family: "Pacifico", name: "Script", weight: 400 },
  { family: "Special Elite", name: "Typewriter", weight: 400 },
];
export const fontOf = (family) => FONTS.find((f) => f.family === family) || FONTS[0];
