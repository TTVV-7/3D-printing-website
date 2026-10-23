// Draws the bike stickers: a name with a flag beside it, and a ride's route
// with where it starts and ends. Each returns { canvas, w, h }: w × h in mm,
// transparent outside the sticker's rounded rectangle (its cut line).
// `px` is pixels per mm: about 12 for the 3D preview, PRINT_DPI / 25.4 for
// the print file.

// The typefaces offered (all loaded by stickers/index.html).
export const BIKE_FONTS = [
  { family: "Bungee", name: "Block", weight: 400 },
  { family: "Space Grotesk", name: "Grotesk", weight: 700 },
  { family: "Bebas Neue", name: "Condensed", weight: 400 },
  { family: "Permanent Marker", name: "Marker", weight: 400 },
];
export const bikeFontOf = (family) => BIKE_FONTS.find((f) => f.family === family) || BIKE_FONTS[0];

const FLAG_RATIO = 3 / 2; // country-flag-icons' 3x2 set

// Every flag in the set, loaded on demand: { CA: () => import(...), ... }.
const FLAG_FILES = import.meta.glob("/node_modules/country-flag-icons/3x2/*.svg", { query: "?url", import: "default" });
const regionName = typeof Intl !== "undefined" && Intl.DisplayNames ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

// [{ code, name }] sorted by name, Canada first.
export const FLAGS = Object.keys(FLAG_FILES)
  .map((path) => path.match(/([A-Z0-9_-]+)\.svg$/)[1])
  .map((code) => {
    let name = code;
    try {
      name = regionName?.of(code) || code;
    } catch {
      // Not a region Intl knows (e.g. EU, GB-SCT): keep the code.
    }
    return { code, name };
  })
  .sort((a, b) => (a.code === "CA" ? -1 : b.code === "CA" ? 1 : a.name.localeCompare(b.name)));

// The flag as a canvas, 600 px wide. The SVGs have no size of their own,
// which some browsers won't draw, so one is added.
const flagCache = new Map();
export function loadFlag(code) {
  if (!flagCache.has(code)) {
    const file = FLAG_FILES[`/node_modules/country-flag-icons/3x2/${code}.svg`];
    flagCache.set(code, file()
      .then((url) => fetch(url))
      .then((r) => r.text())
      .then((svg) => new Promise((ok, fail) => {
        const sized = svg.replace("<svg ", '<svg width="513" height="342" ');
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = 600;
          c.height = 400;
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(img.src);
          ok(c);
        };
        img.onerror = fail;
        img.src = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
      })));
  }
  return flagCache.get(code);
}

function sheet(w, h, px) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * px);
  canvas.height = Math.round(h * px);
  const g = canvas.getContext("2d");
  g.scale(canvas.width / w, canvas.height / h); // draw in mm
  return { canvas, g };
}

function label(g, w, h, bg) {
  g.beginPath();
  g.roundRect(0, 0, w, h, Math.min(w, h) * 0.12);
  g.fillStyle = bg;
  g.fill();
  g.clip();
}

// A font size (mm) whose capitals stand `cap` mm tall.
function capSize(g, font, cap) {
  g.font = `${font.weight} 100px "${font.family}"`;
  const m = g.measureText("H");
  return (cap / (m.actualBoundingBoxAscent || 70)) * 100;
}

// Writes `text` with its capitals centred on y, from x. Returns its width.
function write(g, text, font, size, x, y, colour, measureOnly) {
  g.font = `${font.weight} ${size}px "${font.family}"`;
  const m = g.measureText(text);
  if (!measureOnly) {
    g.fillStyle = colour;
    g.textBaseline = "alphabetic";
    g.fillText(text, x, y + (g.measureText("H").actualBoundingBoxAscent || size * 0.7) / 2);
  }
  return m.width;
}

function drawFlag(g, flag, x, y, h) {
  const w = h * FLAG_RATIO;
  g.drawImage(flag, x, y, w, h);
  // A hairline, so a white flag on a white label still shows its edge.
  g.strokeStyle = "rgba(12,26,46,0.18)";
  g.lineWidth = Math.max(0.12, h * 0.012);
  g.strokeRect(x, y, w, h);
}

// The name on its own colour, the flag to one side. `h` mm tall; as long as
// the name needs.
export function nameSticker({ name, font, flag, flagSide = "right", bg, ink, h }, px) {
  const f = bikeFontOf(font);
  const text = name.trim() || " ";
  const pad = h * 0.2;
  const probe = sheet(1, 1, 1).g;
  const size = capSize(probe, f, h * 0.5);
  const textW = write(probe, text, f, size, 0, 0, ink, true);
  const flagH = h - pad * 1.4;
  const flagW = flag && flagSide !== "none" ? flagH * FLAG_RATIO : 0;
  const gap = flagW ? pad * 1.1 : 0;
  const w = pad * 1.3 + textW + gap + flagW + pad * 1.3;
  const { canvas, g } = sheet(w, h, px);
  label(g, w, h, bg);
  let x = pad * 1.3;
  if (flagW && flagSide === "left") {
    drawFlag(g, flag, x, (h - flagH) / 2, flagH);
    x += flagW + gap;
  }
  write(g, text, f, size, x, h / 2, ink);
  if (flagW && flagSide === "right") drawFlag(g, flag, x + textW + gap, (h - flagH) / 2, flagH);
  return { canvas, w, h };
}

// Web Mercator, so the route has the shape it has on any map.
const project = ([lon, lat]) => [lon, -Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI)];

// The route drawn as a line with a ring where it starts and a dot where it
// ends, the start and end names and the distance beside it.
export function routeSticker({ coords, from, to, km, font, bg, ink, line, w, h }, px) {
  const f = bikeFontOf(font);
  const pad = h * 0.13;
  const { canvas, g } = sheet(w, h, px);
  label(g, w, h, bg);

  // The route, fitted into a box on the left.
  const box = { x: pad, y: pad, w: Math.min(w * 0.38, (h - 2 * pad) * 1.6), h: h - 2 * pad };
  if (coords?.length > 1) {
    const pts = coords.map(project);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const stroke = h * 0.055;
    const inner = { w: box.w - stroke * 2.5, h: box.h - stroke * 2.5 };
    const s = Math.min(inner.w / (x1 - x0 || 1e-9), inner.h / (y1 - y0 || 1e-9));
    // Hug the left edge so the text can start just after the route.
    const ox = box.x + stroke * 1.25 - x0 * s;
    const oy = box.y + (box.h - (y1 - y0) * s) / 2 - y0 * s;
    box.w = (x1 - x0) * s + stroke * 2.5;
    const P = ([x, y]) => [ox + x * s, oy + y * s];
    g.lineJoin = g.lineCap = "round";
    g.strokeStyle = line;
    g.lineWidth = stroke;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(...P(p)) : g.moveTo(...P(p))));
    g.stroke();
    const [sx, sy] = P(pts[0]), [ex, ey] = P(pts[pts.length - 1]);
    g.beginPath();
    g.arc(sx, sy, stroke * 1.15, 0, Math.PI * 2);
    g.fillStyle = bg;
    g.fill();
    g.lineWidth = stroke * 0.7;
    g.strokeStyle = ink;
    g.stroke();
    g.beginPath();
    g.arc(ex, ey, stroke * 1.25, 0, Math.PI * 2);
    g.fillStyle = ink;
    g.fill();
  }

  // Start → end on top, the distance under it, shrunk to fit. Names too
  // long for one line go on two: start →, then end.
  const tx = box.x + box.w + pad * 1.1;
  const room = w - tx - pad;
  const distance = km ? `${km < 100 ? km.toFixed(1) : Math.round(km)} km` : "";
  const d = { family: "Space Grotesk", weight: 700 };
  const fit = (text, font, cap) => {
    const size = capSize(g, font, cap);
    const width = write(g, text, font, size, 0, 0, ink, true);
    return width > room ? (size * room) / width : size;
  };
  const title = [from, to].filter(Boolean).join(" → ") || "Your route";
  const oneLine = fit(title, f, h * 0.17);
  if (from && to && oneLine < capSize(g, f, h * 0.17) * 0.7) {
    const lines = [`${from} →`, to];
    const size = Math.min(...lines.map((t) => fit(t, f, h * 0.14)));
    lines.forEach((t, i) => write(g, t, f, size, tx, h * (0.25 + i * 0.22), ink));
    if (distance) write(g, distance, d, fit(distance, d, h * 0.17), tx, h * 0.76, line);
  } else {
    write(g, title, f, oneLine, tx, distance ? h * 0.36 : h / 2, ink);
    if (distance) write(g, distance, d, fit(distance, d, h * 0.22), tx, h * 0.68, line);
  }
  return { canvas, w, h };
}
