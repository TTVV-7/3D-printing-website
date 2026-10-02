// The intro background: real contour lines of the North Shore Mountains
// (Cypress to Seymour, Burrard Inlet along the bottom), traced from the
// height map built by scripts/topo-heightmap.mjs. Scrolling pushes the view
// in toward the peaks while an orange contour climbs from sea level to the
// summits, like the mountains being printed layer by layer. Plain 2D canvas, no dependencies; it only draws
// when something changes.

// --- Contours ------------------------------------------------------------
const CELL = 12; // CSS px per grid cell
const INTERVAL = 100; // metres between contour lines
const TOP = 1700; // highest contour (Brunswick-ish; Grouse is ~1230 m)

// Marching squares: append the segments where the field crosses `level`.
function traceLevel(ctx, field, cols, rows, level) {
  const lerp = (a, b) => (level - a) / (b - a);
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const i = y * cols + x;
      const a = field[i], b = field[i + 1], c = field[i + cols + 1], d = field[i + cols];
      const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;

      const px = x * CELL, py = y * CELL;
      const top = [px + CELL * lerp(a, b), py];
      const right = [px + CELL, py + CELL * lerp(b, c)];
      const bottom = [px + CELL * lerp(d, c), py + CELL];
      const left = [px, py + CELL * lerp(a, d)];

      const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
      switch (idx) {
        case 1: case 14: seg(left, bottom); break;
        case 2: case 13: seg(bottom, right); break;
        case 3: case 12: seg(left, right); break;
        case 4: case 11: seg(top, right); break;
        case 6: case 9: seg(top, bottom); break;
        case 7: case 8: seg(left, top); break;
        case 5: seg(left, top); seg(bottom, right); break;
        case 10: seg(top, right); seg(left, bottom); break;
      }
    }
  }
}

async function loadHeights(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = new DataView(await res.arrayBuffer());
  const w = buf.getUint16(0, true), h = buf.getUint16(2, true);
  const heights = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) heights[i] = buf.getUint8(4 + i) * 7 - 20; // see the script
  // Two passes of a 3x3 blur smooth out the 7 m steps so lines don't zigzag.
  for (let pass = 0; pass < 2; pass++) {
    const src = heights.slice();
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += src[(y + dy) * w + x + dx];
        heights[y * w + x] = sum / 9;
      }
    }
  }
  return { w, h, heights };
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export async function mountTopo(canvas, { reducedMotion = false, onLayer } = {}) {
  const map = await loadHeights("/topo/north-shore.bin");
  const ctx = canvas.getContext("2d");
  let cols = 0, rows = 0, field = new Float32Array(0);
  let width = 0, height = 0, raf = 0;
  let target = 0; // scroll progress through the intro, 0..1
  let progress = 0; // eased toward target

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(width / CELL) + 2;
    rows = Math.ceil(height / CELL) + 2;
    field = new Float32Array(cols * rows);
  }

  // Bilinear height at map pixel (u, v).
  function sample(u, v) {
    u = clamp(u, 0, map.w - 1.001);
    v = clamp(v, 0, map.h - 1.001);
    const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y;
    const i = y * map.w + x, H = map.heights;
    return lerp(lerp(H[i], H[i + 1], fx), lerp(H[i + map.w], H[i + map.w + 1], fx), fy);
  }

  function draw() {
    // Cover the canvas with the map, then zoom toward the peaks with scroll.
    const p = progress;
    const scale = Math.max(width / map.w, height / map.h) * lerp(1.05, 1.45, p);
    const focusU = map.w * lerp(0.5, 0.47, p);
    const focusV = map.h * lerp(0.5, 0.3, p);
    const ox = clamp(width / 2 - focusU * scale, width - map.w * scale, 0);
    const oy = clamp(height / 2 - focusV * scale, height - map.h * scale, 0);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        field[y * cols + x] = sample((x * CELL - ox) / scale, (y * CELL - oy) / scale);
      }
    }

    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";

    // Coastline.
    ctx.beginPath();
    traceLevel(ctx, field, cols, rows, 2);
    ctx.strokeStyle = "rgba(90,169,230,0.45)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Contours every 100 m, with every 500 m heavier like a printed map.
    for (let m = INTERVAL; m <= TOP; m += INTERVAL) {
      const index = m % 500 === 0;
      ctx.beginPath();
      traceLevel(ctx, field, cols, rows, m);
      ctx.strokeStyle = index ? "rgba(90,169,230,0.34)" : "rgba(90,169,230,0.15)";
      ctx.lineWidth = index ? 1.4 : 1;
      ctx.stroke();
    }

    // The layer being printed.
    const layer = lerp(150, 1450, p);
    ctx.beginPath();
    traceLevel(ctx, field, cols, rows, layer);
    ctx.strokeStyle = "rgba(255,91,31,0.95)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(255,91,31,0.8)";
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    onLayer?.(Math.round(layer / 10) * 10);
  }

  // Draw only while the scroll is still easing in, then go idle.
  function frame() {
    raf = 0;
    progress = reducedMotion ? target : lerp(progress, target, 0.18);
    draw();
    if (Math.abs(progress - target) > 0.001) kick();
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  const onScroll = () => {
    const rect = canvas.getBoundingClientRect();
    target = clamp(-rect.top / rect.height, 0, 1);
    if (rect.bottom > 0) kick();
  };
  const onResize = () => { resize(); kick(); };

  resize();
  onScroll();
  progress = target;
  draw();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    },
  };
}
