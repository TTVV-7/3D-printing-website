// Measures STL / 3MF files in the browser and turns the measurements into a
// ballpark price. Imported dynamically so three.js only loads once someone
// actually drops a model into the quote form.
import { Vector3 } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

// Sums over every triangle: signed tetrahedron volume (closed meshes give the
// enclosed volume), surface area and the bounding box. All in file units.
function addGeometry(acc, geometry, matrix) {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  const count = index ? index.count : pos.count;
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  const ab = new Vector3(), ac = new Vector3();

  const vertex = (v, i) => {
    v.fromBufferAttribute(pos, index ? index.getX(i) : i);
    if (matrix) v.applyMatrix4(matrix);
    acc.min.min(v);
    acc.max.max(v);
  };

  for (let i = 0; i + 2 < count; i += 3) {
    vertex(a, i);
    vertex(b, i + 1);
    vertex(c, i + 2);
    acc.volume += a.dot(ab.crossVectors(b, c)) / 6;
    acc.area += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
    acc.triangles += 1;
  }
}

// Returns { measure, geometries }: measure is { volume (mm³), area (mm²),
// size [x, y, z] (mm), triangles } assuming the file is in millimetres, and
// geometries are the parsed meshes (transforms applied) for the 3D preview.
// Throws if the file can't be read.
export async function measureFile(file) {
  const buffer = await file.arrayBuffer();
  const acc = {
    volume: 0, area: 0, triangles: 0,
    min: new Vector3(Infinity, Infinity, Infinity),
    max: new Vector3(-Infinity, -Infinity, -Infinity),
  };
  const geometries = [];

  if (file.name.toLowerCase().endsWith(".3mf")) {
    const group = new ThreeMFLoader().parse(buffer);
    group.updateMatrixWorld(true);
    group.traverse((o) => {
      if (!o.isMesh) return;
      addGeometry(acc, o.geometry, o.matrixWorld);
      geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
    });
  } else {
    const geometry = new STLLoader().parse(buffer);
    addGeometry(acc, geometry, null);
    geometries.push(geometry);
  }

  if (!acc.triangles) throw new Error("No triangles found");
  const size = acc.max.clone().sub(acc.min);
  const measure = {
    // Inside-out meshes come out negative; the magnitude is still right.
    volume: Math.abs(acc.volume),
    area: acc.area,
    size: [size.x, size.y, size.z],
    triangles: acc.triangles,
  };
  return { measure, geometries };
}

// Applies a unit scale (25.4 for inches) to a measurement.
export function scaleMeasure(m, scale) {
  if (scale === 1) return m;
  return {
    ...m,
    volume: m.volume * scale ** 3,
    area: m.area * scale ** 2,
    size: m.size.map((d) => d * scale),
  };
}

// A model whose largest side is this small was probably exported in inches.
export const PROBABLY_INCHES_MM = 12;

// Flags that make a measurement untrustworthy or the part unprintable as-is.
export function checkMeasure(m, cfg) {
  const boxVolume = m.size[0] * m.size[1] * m.size[2];
  return {
    // A closed mesh can't hold more than its bounding box, or nearly nothing.
    unreliable: !(m.volume > 0) || m.volume > boxVolume * 1.01 || m.volume < boxVolume * 0.001,
    tooBig: m.size.some((d) => d > cfg.maxSizeMm),
    tiny: Math.max(...m.size) < PROBABLY_INCHES_MM,
  };
}

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

// Prices a whole order: `parts` is [{ measure }], options are the form's
// material / quality / quantity. Returns totals for the order.
export function estimateOrder(parts, options, cfg) {
  const quantity = Math.max(1, Number(options.quantity) || 1);
  const discount = cfg.bulk.find((b) => quantity >= b.min)?.off ?? 0;

  // Per-copy cost of one set of parts, plus setup once per file.
  let gramsEach = 0, hoursEach = 0, filamentEach = 0, timeEach = 0, setup = 0;
  for (const { measure } of parts) {
    const u = partUsage(measure, options, cfg);
    gramsEach += u.grams;
    hoursEach += u.hours;
    filamentEach += u.grams * u.perGram;
    timeEach += u.hours * cfg.machinePerHour;
    setup += cfg.setupPerPart;
  }
  const costFor = (q) => {
    const off = cfg.bulk.find((b) => q >= b.min)?.off ?? 0;
    return ((filamentEach + timeEach) * q + setup) * (1 - off);
  };

  const raw = costFor(quantity);
  const total = Math.max(cfg.orderMinimum, raw);

  // Under the minimum the customer is paying for unused capacity: find how
  // many copies the same price would cover (capped so it stays sensible).
  let sameCopies = quantity;
  while (sameCopies < 20 && costFor(sameCopies + 1) <= cfg.orderMinimum) sameCopies += 1;

  const grams = gramsEach * quantity, hours = hoursEach * quantity;
  const filamentCost = filamentEach * quantity, timeCost = timeEach * quantity;
  return {
    quantity,
    discount,
    belowMinimum: raw < cfg.orderMinimum,
    sameCopies,
    grams,
    hours,
    filamentCost,
    timeCost,
    total,
    // At the minimum the price is simply the minimum, no range.
    low: raw < cfg.orderMinimum ? cfg.orderMinimum : Math.max(cfg.orderMinimum, Math.floor(total * cfg.low)),
    high: raw < cfg.orderMinimum ? cfg.orderMinimum : Math.max(cfg.orderMinimum, Math.ceil(total * cfg.high)),
  };
}
