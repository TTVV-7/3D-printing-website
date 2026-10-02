// Animated topographic contour lines for the intro screen. A slowly drifting
// noise field is traced with marching squares, like a relief map, and one
// orange contour climbs through it like the layer a printer is on.
// Plain 2D canvas, no dependencies.

// --- 3D simplex noise (Stefan Gustavson's reference, trimmed) -------------
const GRAD = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

function makeNoise(seed = 1) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const F3 = 1 / 3;
  const G3 = 1 / 6;

  return function noise(x, y, z) {
    const t = (x + y + z) * F3;
    const i = Math.floor(x + t), j = Math.floor(y + t), k = Math.floor(z + t);
    const u = (i + j + k) * G3;
    const x0 = x - i + u, y0 = y - j + u, z0 = z - k + u;
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0];
      else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1];
      else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1];
    } else if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1];
    else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1];
    else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0];

    const corners = [
      [x0, y0, z0, 0, 0, 0],
      [x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3, i1, j1, k1],
      [x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3, i2, j2, k2],
      [x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3, 1, 1, 1],
    ];
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0;
    for (const [cx, cy, cz, di, dj, dk] of corners) {
      let tt = 0.6 - cx * cx - cy * cy - cz * cz;
      if (tt < 0) continue;
      const g = GRAD[perm[ii + di + perm[jj + dj + perm[kk + dk]]] % 12];
      tt *= tt;
      n += tt * tt * (g[0] * cx + g[1] * cy + g[2] * cz);
    }
    return 32 * n; // roughly -1..1
  };
}

// --- Contours ------------------------------------------------------------
const CELL = 14; // CSS px per grid cell
const LEVELS = 18; // contour lines from low to high
const LAYER_PERIOD = 14; // seconds for the orange layer to climb top to bottom

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

export function mountTopo(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext("2d");
  const noise = makeNoise(7);
  let cols = 0, rows = 0, field = new Float32Array(0);
  let width = 0, height = 0;
  let raf = 0, running = false, last = 0;
  const pointer = { x: -1e4, y: -1e4, strength: 0 };

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

  function draw(t) {
    // Fill the height field: two octaves of drifting noise, plus a soft hill
    // that rises under the pointer.
    const s = 0.0028;
    const z = t * 0.045;
    const r2 = 160 * 160;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const wx = x * CELL, wy = y * CELL;
        let v = noise(wx * s, wy * s, z) * 0.8 + noise(wx * s * 2.3, wy * s * 2.3, z * 1.4) * 0.25;
        if (pointer.strength > 0.01) {
          const dx = wx - pointer.x, dy = wy - pointer.y;
          v += 0.55 * pointer.strength * Math.exp(-(dx * dx + dy * dy) / r2);
        }
        field[y * cols + x] = v;
      }
    }

    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";

    // Ordinary contours, with every fifth one heavier like an index contour.
    for (let l = 0; l < LEVELS; l++) {
      const level = -0.85 + (1.7 * l) / (LEVELS - 1);
      const index = l % 5 === 0;
      ctx.beginPath();
      traceLevel(ctx, field, cols, rows, level);
      ctx.strokeStyle = index ? "rgba(90,169,230,0.32)" : "rgba(90,169,230,0.14)";
      ctx.lineWidth = index ? 1.4 : 1;
      ctx.stroke();
    }

    // The layer being printed: one orange contour sweeping up the terrain.
    const phase = reducedMotion ? 0.55 : (t / LAYER_PERIOD) % 1;
    const layer = -0.8 + 1.6 * phase;
    ctx.beginPath();
    traceLevel(ctx, field, cols, rows, layer);
    ctx.strokeStyle = "rgba(255,91,31,0.9)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(255,91,31,0.8)";
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return; // ~30 fps is plenty for a slow drift
    last = now;
    pointer.strength *= 0.97;
    draw(now / 1000);
  }

  function start() {
    if (running || reducedMotion) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const onResize = () => { resize(); draw(performance.now() / 1000); };
  const onMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.strength = 1;
  };
  const onVisibility = () => (document.hidden ? stop() : start());

  // Only animate while the intro is on screen.
  const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));

  resize();
  draw(performance.now() / 1000);
  io.observe(canvas);
  window.addEventListener("resize", onResize);
  if (!reducedMotion) window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  return {
    dispose() {
      stop();
      io.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
