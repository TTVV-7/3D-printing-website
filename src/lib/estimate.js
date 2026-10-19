// Measures attached STL / 3MF files in the browser and turns them into a
// rough price range, plus a preview image of each part for the emails.
// Loaded on demand from QuoteForm, only when a model file is attached.
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { unzipSync, strFromU8 } from "three/examples/jsm/libs/fflate.module.js";
import { estimate as cfg } from "../../site.config.js";

export const MEASURABLE = [".stl", ".3mf"];

export function isMeasurable(name) {
  const lower = name.toLowerCase();
  return MEASURABLE.some((ext) => lower.endsWith(ext));
}

// ---------------------------------------------------------------------------
// Parsing: every format ends up as a flat Float32Array of triangle corners
// (x, y, z × 3 per triangle), in millimetres.
// ---------------------------------------------------------------------------

function parseStl(buffer) {
  const geometry = new STLLoader().parse(buffer);
  const positions = geometry.getAttribute("position").array;
  geometry.dispose();
  return positions;
}

const UNIT_MM = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

// 3MF transforms are "m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32"
// (row vectors). Matrix4.set takes rows of the column-vector form.
function parseTransform(attr) {
  const m = new THREE.Matrix4();
  if (!attr) return m;
  const v = attr.trim().split(/\s+/).map(Number);
  if (v.length !== 12 || v.some(Number.isNaN)) return m;
  m.set(v[0], v[3], v[6], v[9], v[1], v[4], v[7], v[10], v[2], v[5], v[8], v[11], 0, 0, 0, 1);
  return m;
}

// Children by local name, so namespace prefixes (p:, m:, none) don't matter.
const kids = (node, name) => Array.from(node.children).filter((c) => c.localName === name);
const kid = (node, name) => kids(node, name)[0];
const attr = (node, name) => Array.from(node.attributes).find((a) => a.localName === name)?.value;

// Handles plain 3MFs and Bambu Studio / Orca projects, which keep each part
// in its own 3D/Objects/*.model file and reference it with p:path components.
// three's 3MFLoader can't follow those references, hence this reader.
function parse3mf(buffer) {
  const zip = unzipSync(new Uint8Array(buffer), {
    filter: (f) => /\.model$/i.test(f.name) || /_rels\/\.rels$/i.test(f.name),
  });

  const models = {};
  for (const [name, bytes] of Object.entries(zip)) {
    if (!/\.model$/i.test(name)) continue;
    const doc = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
    models["/" + name.replace(/^\//, "")] = doc.documentElement;
  }

  const rels = Object.entries(zip).find(([n]) => /_rels\/\.rels$/i.test(n));
  let rootPath = Object.keys(models).find((p) => /^\/3D\/3dmodel\.model$/i.test(p));
  if (rels) {
    const target = strFromU8(rels[1]).match(/Target="([^"]+\.model)"/i);
    if (target) rootPath = "/" + target[1].replace(/^\//, "");
  }
  const root = models[rootPath];
  if (!root) throw new Error("No 3D model inside this 3MF");

  const objectsIn = (path) => {
    const model = models[path];
    const resources = model && kid(model, "resources");
    return resources ? kids(resources, "object") : [];
  };

  const out = [];
  const v = new THREE.Vector3();

  function emit(path, id, matrix, depth) {
    if (depth > 16) return;
    const object = objectsIn(path).find((o) => o.getAttribute("id") === id);
    if (!object) return;
    const unit = UNIT_MM[models[path].getAttribute("unit") || "millimeter"] ?? 1;

    const mesh = kid(object, "mesh");
    if (mesh) {
      const coords = kids(kid(mesh, "vertices"), "vertex").map((n) => [
        parseFloat(n.getAttribute("x")) * unit,
        parseFloat(n.getAttribute("y")) * unit,
        parseFloat(n.getAttribute("z")) * unit,
      ]);
      // A mirroring transform flips the winding; undo it so volumes don't cancel.
      const corners = matrix.determinant() < 0 ? ["v1", "v3", "v2"] : ["v1", "v2", "v3"];
      for (const t of kids(kid(mesh, "triangles"), "triangle")) {
        for (const a of corners) {
          const c = coords[Number(t.getAttribute(a))];
          if (!c) return;
          v.set(c[0], c[1], c[2]).applyMatrix4(matrix);
          out.push(v.x, v.y, v.z);
        }
      }
    }

    const components = kid(object, "components");
    if (components) {
      for (const comp of kids(components, "component")) {
        const childPath = attr(comp, "path") || path;
        const m = matrix.clone().multiply(parseTransform(comp.getAttribute("transform")));
        emit(childPath, comp.getAttribute("objectid"), m, depth + 1);
      }
    }
  }

  const build = kid(root, "build");
  for (const item of build ? kids(build, "item") : []) {
    if (item.getAttribute("printable") === "0") continue;
    const path = attr(item, "path") || rootPath;
    emit(path, item.getAttribute("objectid"), parseTransform(item.getAttribute("transform")), 0);
  }

  return new Float32Array(out);
}

// ---------------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------------

function measure(positions) {
  let volume = 0;
  let area = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  const box = new THREE.Box3();

  for (let i = 0; i + 8 < positions.length; i += 9) {
    a.fromArray(positions, i);
    b.fromArray(positions, i + 3);
    c.fromArray(positions, i + 6);
    // Signed tetrahedron volume against the origin; sums to the solid's volume.
    volume += a.dot(ab.copy(b).cross(c)) / 6;
    area += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
    box.expandByPoint(a).expandByPoint(b).expandByPoint(c);
  }

  const size = box.getSize(new THREE.Vector3());
  return { volume: Math.abs(volume), area, size: [size.x, size.y, size.z] };
}

// Grams and hours for one copy, as a [low, high] pair each.
function printRange({ volume, area }, material, quality) {
  const mat = cfg.materials[material] || cfg.materials.PLA;
  const shell = Math.min(volume, area * cfg.wallMm);
  const inside = volume - shell;
  const gramsFor = (infill) => ((shell + inside * infill) * mat.density) / 1000;
  const grams = [gramsFor(cfg.infill[0]), gramsFor(cfg.infill[1]) * (1 + cfg.supportAllowance)];
  const q = cfg.quality[quality] ?? 1;
  const hours = [(grams[0] / cfg.gramsPerHour[0]) * q, (grams[1] / cfg.gramsPerHour[1]) * q];
  const cost = (i) => grams[i] * mat.perGram + hours[i] * cfg.perHour;
  return { grams, hours, cost: [cost(0), cost(1)] };
}

// ---------------------------------------------------------------------------
// Preview image
// ---------------------------------------------------------------------------

let renderer = null;

function renderPreview(positions) {
  const width = 480, height = 360;
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const { center, radius } = geometry.boundingSphere;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f4f1ea");
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: "#e8622c", roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide }),
  );
  scene.add(mesh);
  scene.add(new THREE.HemisphereLight("#ffffff", "#8a7f72", 1.6));
  const key = new THREE.DirectionalLight("#ffffff", 2.2);
  key.position.set(center.x + radius * 2, center.y - radius * 3, center.z + radius * 4);
  scene.add(key);

  // Models are Z-up. Three-quarter view from the front right, slightly above.
  const camera = new THREE.PerspectiveCamera(30, width / height, radius / 100, radius * 20);
  camera.up.set(0, 0, 1);
  const dir = new THREE.Vector3(1, -1.4, 0.9).normalize();
  const distance = radius / Math.sin(THREE.MathUtils.degToRad(30 / 2)) * 1.05;
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.lookAt(center);

  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL("image/png");

  geometry.dispose();
  mesh.material.dispose();
  return dataUrl;
}

async function dataUrlToBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const round1 = (n) => Math.round(n * 10) / 10;
// Whole dollars, rounded outward, never below $1 (tiny parts aren't free).
const dollars = ([low, high]) => [Math.max(1, Math.floor(low)), Math.max(1, Math.ceil(high))];

// Measures one file. Never throws: a file that can't be read comes back with
// `error` set and gets priced by hand.
export async function analyzeFile(file, { material, quality, quantity }) {
  try {
    const buffer = await file.arrayBuffer();
    const positions = file.name.toLowerCase().endsWith(".3mf") ? parse3mf(buffer) : parseStl(buffer);
    if (positions.length < 9) throw new Error("No triangles found");

    const dims = measure(positions);
    if (dims.volume < 1) throw new Error("Model has no measurable volume");
    const range = printRange(dims, material, quality);

    let preview = null;
    try {
      preview = await dataUrlToBlob(renderPreview(positions));
    } catch {
      // No WebGL (old phone, blocked GPU): the estimate still goes out.
    }

    return {
      preview,
      estimate: {
        sizeMm: dims.size.map((n) => Math.round(n)),
        volumeCm3: round1(dims.volume / 1000),
        // Grams, hours and price cover every copy; `each` is one copy.
        // The setup fee and order minimum are added in orderTotal.
        grams: range.grams.map((n) => round1(n * quantity)),
        hours: range.hours.map((n) => round1(n * quantity)),
        each: dollars(range.cost),
        price: dollars(range.cost.map((n) => n * quantity)),
        tooBig: dims.size.some((n) => n > cfg.bedMm),
      },
    };
  } catch (err) {
    return { preview: null, estimate: { error: err.message || "Couldn't read this file" } };
  }
}

// Order total from the per-file estimates. `partial` means some files
// (STEP, photos, unreadable models) still need pricing by hand.
export function orderTotal(estimates, hasUnpricedFiles) {
  const priced = estimates.filter((e) => e && !e.error);
  if (!priced.length) return null;
  const sum = (i) => priced.reduce((s, e) => s + e.price[i], 0);
  const total = (i) => Math.max(cfg.minimumOrder, cfg.setupFee + sum(i));
  return {
    price: [Math.floor(total(0)), Math.ceil(total(1))],
    grams: [0, 1].map((i) => round1(priced.reduce((s, e) => s + e.grams[i], 0))),
    hours: [0, 1].map((i) => round1(priced.reduce((s, e) => s + e.hours[i], 0))),
    setupFee: cfg.setupFee,
    minimumOrder: cfg.minimumOrder,
    partial: hasUnpricedFiles || priced.length < estimates.length,
  };
}
