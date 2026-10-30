// Measures STL / 3MF files in the browser and turns the measurements into a
// ballpark price. Imported dynamically so three.js only loads once someone
// actually drops a model into the quote form.
import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { unzipSync, strFromU8 } from "three/examples/jsm/libs/fflate.module.js";

import { partUsage, partEstimate } from "./estimateMath.js";

// The price maths lives in estimateMath.js (no three.js), so the server's
// price chat can use it too.
export { partUsage, partEstimate };

const UNIT_MM = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

// 3MF transforms are "m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32"
// (row vectors). Matrix4.set takes rows of the column-vector form.
function parseTransform(attr) {
  const m = new Matrix4();
  if (!attr) return m;
  const v = attr.trim().split(/\s+/).map(Number);
  if (v.length !== 12 || v.some(Number.isNaN)) return m;
  m.set(v[0], v[3], v[6], v[9], v[1], v[4], v[7], v[10], v[2], v[5], v[8], v[11], 0, 0, 0, 1);
  return m;
}

// Children and attributes by local name, so namespace prefixes don't matter.
const kids = (node, name) => Array.from(node?.children || []).filter((c) => c.localName === name);
const kid = (node, name) => kids(node, name)[0];
const attr = (node, name) => Array.from(node.attributes).find((a) => a.localName === name)?.value;

// Reads a 3MF into one geometry per build item, in millimetres. Handles plain
// 3MFs and Bambu Studio / Orca projects, which keep each part in its own
// 3D/Objects/*.model file behind p:path components -- three's 3MFLoader
// doesn't follow those and finds no triangles.
function parse3mf(buffer) {
  const zip = unzipSync(new Uint8Array(buffer), {
    filter: (f) => /\.model$/i.test(f.name) || /_rels\/\.rels$/i.test(f.name),
  });
  const models = {};
  let rels = null;
  for (const [name, bytes] of Object.entries(zip)) {
    if (/_rels\/\.rels$/i.test(name)) rels = strFromU8(bytes);
    else models["/" + name.replace(/^\//, "")] = new DOMParser().parseFromString(strFromU8(bytes), "application/xml").documentElement;
  }
  const target = rels?.match(/Target="([^"]+\.model)"/i)?.[1];
  const rootPath = target ? "/" + target.replace(/^\//, "") : Object.keys(models).find((p) => /^\/3D\/3dmodel\.model$/i.test(p));
  const root = models[rootPath];
  if (!root) throw new Error("No 3D model inside this 3MF");

  const v = new Vector3();
  function emit(out, path, id, matrix, depth) {
    const model = models[path];
    const object = depth < 16 && kids(kid(model, "resources"), "object").find((o) => o.getAttribute("id") === id);
    if (!object) return;
    const unit = UNIT_MM[model.getAttribute("unit") || "millimeter"] ?? 1;

    const mesh = kid(object, "mesh");
    if (mesh) {
      const coords = kids(kid(mesh, "vertices"), "vertex").map((n) => ["x", "y", "z"].map((k) => parseFloat(n.getAttribute(k)) * unit));
      // A mirroring transform flips the winding; undo it so volumes don't cancel.
      const corners = matrix.determinant() < 0 ? ["v1", "v3", "v2"] : ["v1", "v2", "v3"];
      for (const t of kids(kid(mesh, "triangles"), "triangle")) {
        const tri = corners.map((a) => coords[Number(t.getAttribute(a))]);
        if (tri.some((c) => !c)) continue;
        for (const c of tri) {
          v.set(c[0], c[1], c[2]).applyMatrix4(matrix);
          out.push(v.x, v.y, v.z);
        }
      }
    }
    for (const comp of kids(kid(object, "components"), "component")) {
      const m = matrix.clone().multiply(parseTransform(comp.getAttribute("transform")));
      emit(out, attr(comp, "path") || path, comp.getAttribute("objectid"), m, depth + 1);
    }
  }

  const geometries = [];
  for (const item of kids(kid(root, "build"), "item")) {
    if (item.getAttribute("printable") === "0") continue;
    const out = [];
    emit(out, attr(item, "path") || rootPath, item.getAttribute("objectid"), parseTransform(item.getAttribute("transform")), 0);
    if (!out.length) continue;
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(out), 3));
    geometries.push(g);
  }
  return geometries;
}

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
    for (const g of parse3mf(buffer)) {
      addGeometry(acc, g, null);
      geometries.push(g);
    }
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
