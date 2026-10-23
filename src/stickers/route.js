// Routes for trail stickers: drawn by hand or read from a GPX file (Strava,
// Garmin, Trailforks, AllTrails and the rest all export one), turned into a
// clean line and drawn as a "route" layer (thermal.js).
//
// A route layer keeps `points`, centred, the longer side 1 long, y down;
// `aspect` (width / height); `width` (line, mm); `dash`; `ends` (start dot
// and finish ring).

export const ROUTE_WIDTHS = [
  ["Thin", 0.8],
  ["Medium", 1.2],
  ["Bold", 1.8],
];

// Ramer-Douglas-Peucker: drops points that don't change the shape by more
// than `eps`.
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
  let far = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    // A loop ends where it starts: measure from that point instead.
    const d = len ? Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
    if (d > far) (far = d), (at = i);
  }
  if (far <= eps) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, at + 1), eps).slice(0, -1), ...simplify(pts.slice(at), eps)];
}

// Chaikin corner cutting: rounds off a hand-drawn line, keeping its ends.
function smooth(pts, rounds = 2) {
  for (let r = 0; r < rounds && pts.length > 2; r++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

// Centres the points and scales the longer side to 1. Null if there's no
// real line.
export function normalise(raw, { round = false } = {}) {
  const xs = raw.map((p) => p[0]), ys = raw.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY);
  if (!(span > 0) || raw.length < 2) return null;
  let pts = raw.map(([x, y]) => [(x - (minX + maxX) / 2) / span, (y - (minY + maxY) / 2) / span]);
  pts = simplify(pts, 0.004);
  if (round) pts = smooth(pts);
  // Plenty for a sticker a few cm across, and small enough to save.
  while (pts.length > 600) pts = pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1);
  const w = maxX - minX, h = maxY - minY;
  return { points: pts.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]), aspect: Math.max(0.15, Math.min(6, w / (h || w / 6))) };
}

// The track (or route) points of a GPX file, as a flat map projection; null
// if it has none.
export function readGpx(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  let nodes = [...doc.getElementsByTagName("trkpt")];
  if (nodes.length < 2) nodes = [...doc.getElementsByTagName("rtept")];
  const ll = nodes.map((n) => [Number(n.getAttribute("lon")), Number(n.getAttribute("lat"))]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  return fromLonLat(ll);
}

// A route from [lon, lat] points (a GPX track, or a route found between
// addresses, places.js); null if there's no line.
export function fromLonLat(ll) {
  if (ll.length < 2) return null;
  const lat0 = (ll.reduce((s, p) => s + p[1], 0) / ll.length) * (Math.PI / 180);
  // East is right, north is up (so y, which runs down, is minus latitude).
  return normalise(ll.map(([lon, lat]) => [lon * Math.cos(lat0), -lat]));
}

// Draws a route centred on the origin, `scale` px per unit of its points.
// `px` is px per mm, for the line width. With `halo`, a white edge first so
// it reads over a pattern.
export function drawRoute(ctx, { points, width = 1.2, dash = false, ends = true }, scale, px, halo) {
  if (!points?.length) return;
  const lw = width * px;
  const path = new Path2D();
  points.forEach(([x, y], i) => (i ? path.lineTo(x * scale, y * scale) : path.moveTo(x * scale, y * scale)));
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (halo) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = lw + 1.4 * px;
    ctx.setLineDash([]);
    ctx.stroke(path);
  }
  ctx.strokeStyle = "#000";
  ctx.lineWidth = lw;
  ctx.setLineDash(dash ? [lw * 1.8, lw * 1.6] : []);
  ctx.stroke(path);
  ctx.setLineDash([]);
  if (ends) {
    const [sx, sy] = points[0], [ex, ey] = points[points.length - 1];
    // Start: a solid dot. Finish: a ring (the same spot on a loop).
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(sx * scale, sy * scale, lw * 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.lineWidth = lw * 0.9;
    ctx.beginPath();
    ctx.arc(ex * scale, ey * scale, lw * (Math.hypot(ex - sx, ey - sy) * scale < lw * 3 ? 2.8 : 1.8), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// A sample loop for the trail template, to swap for your own.
export const SAMPLE_ROUTE = normalise(
  [[0, 0], [14, -10], [30, -12], [42, -26], [58, -30], [70, -20], [74, -4], [66, 10], [72, 24], [60, 36], [44, 32], [34, 42], [18, 40], [8, 28], [12, 14], [2, 6]],
  { round: true },
);
