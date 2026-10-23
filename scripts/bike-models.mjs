// Builds the bikes the bike stickers are shown on.
//
//   SKETCHFAB_TOKEN=... node scripts/bike-models.mjs          # all of them
//   SKETCHFAB_TOKEN=... node scripts/bike-models.mjs road     # just the named ones
//
// Downloads each model from Sketchfab (your API token: sketchfab.com →
// Settings → Password & API), keeps a copy in .cache/bikes so later runs
// don't download again, then writes one small GLB per bike to
// public/models/bikes:
//
// - the textures go, and every part is sorted into one of three materials:
//   "paint" (the frame and fork, recoloured on the page), "dark" (tyres,
//   saddle, grips, black components) and "metal" (chainrings, spokes, chrome)
// - turned so the front wheel points along +x, standing on y = 0, centred,
//   and scaled to the bike's real length, in metres
// - simplified and Draco-compressed (the decoder is in public/draco)
//
// All three are CC BY 4.0: the credits are in src/stickers/bikeModels.js and on
// the page. Only needed again when a model changes.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { draco, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import draco3d from "draco3dgltf";
import { PNG } from "pngjs";

const OUT = new URL("../public/models/bikes/", import.meta.url);
const CACHE = new URL("../.cache/bikes/", import.meta.url);

const MATERIALS = {
  paint: { color: [0.8, 0.06, 0.1], metallic: 0, roughness: 0.35 },
  dark: { color: [0.025, 0.025, 0.028], metallic: 0, roughness: 0.75 },
  metal: { color: [0.62, 0.64, 0.67], metallic: 1, roughness: 0.3 },
};

// The Dutch bike's parts, in file order (Object_4, Object_6, ...): it has a
// single white material, so each part is named here. Its wheels are tyre,
// rim and hub in one: split by distance from the hub.
const DUTCH = {
  paint: [6, 7, 8, 12, 13, 14, 15, 16, 26, 30, 31],
  dark: [9, 10, 18, 19, 20, 21, 25, 27, 33],
  wheel: [17, 32],
};

const BIKES = {
  road: {
    uid: "cb03b0657fbc4693b59194124ba713db",
    length: 1.71, // a 56 cm road bike, tyre to tyre
    // Its materials say what each part is. The frame is two of them.
    part: ({ material }) =>
      ["rama", "orange.metal"].includes(material) ? "paint"
        : ["metal.silver", "metal.silver2"].includes(material) ? "metal"
        : "dark",
    ratio: 0.12,
    error: 0.001,
  },
  mountain: {
    uid: "d5c7ab157aa84eb08e2deaee6165e764",
    length: 1.78, // a medium 27.5" hardtail
    flip: true, // modelled facing -x
    // One textured material: sorted triangle by triangle by its texture.
    part: ({ sample }) => {
      const [r, g, b, metal] = sample();
      if (metal > 0.5) return "metal";
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      // White paint and the lime and navy decals on it: all frame.
      return lum > 0.55 || sat > 0.25 ? "paint" : "dark";
    },
    byPiece: true,
    ratio: 0.5,
  },
  city: {
    uid: "1967bfe65c164c589351985e7becc8b8",
    length: 1.88, // a 28" Dutch step-through
    part: ({ index, wheel }) =>
      DUTCH.paint.includes(index) ? "paint"
        : DUTCH.dark.includes(index) ? "dark"
        : DUTCH.wheel.includes(index) ? (wheel() > 0.9 ? "dark" : "metal")
        : "metal",
    ratio: 0.6,
    smooth: true, // its own normals leave a dark smear down the frame
  },
};

async function original(name, uid) {
  const file = new URL(`${name}.glb`, CACHE);
  if (existsSync(file)) return readFile(file);
  const token = process.env.SKETCHFAB_TOKEN || process.env.SketchFab_API;
  if (!token) throw new Error("Set SKETCHFAB_TOKEN (sketchfab.com → Settings → Password & API)");
  const res = await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
  const { glb } = await res.json();
  const data = Buffer.from(await (await fetch(glb.url)).arrayBuffer());
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, data);
  return data;
}

// Reads a texture once, then returns [r, g, b, metallic] (0-1) at a UV.
function sampler(texture, mr) {
  const png = (t) => t && PNG.sync.read(Buffer.from(t.getImage()));
  const base = png(texture), metal = png(mr);
  const at = (img, u, v) => {
    const x = Math.min(img.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * img.width)));
    const y = Math.min(img.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * img.height)));
    const i = (y * img.width + x) * 4;
    return [img.data[i] / 255, img.data[i + 1] / 255, img.data[i + 2] / 255];
  };
  return (u, v) => [...at(base, u, v), metal ? at(metal, u, v)[2] : 0];
}

// Each connected piece takes the part most of its surface was sorted into,
// so a decal or a scuff on the frame stays frame. Pieces are joined where
// they share a point (UV seams split the file's vertices, not its points).
function byPiece(tris, pos) {
  const key = (i) => pos[i].map((v) => Math.round(v * 1e5)).join();
  const id = new Map();
  const parent = [];
  const find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const node = (i) => {
    const k = key(i);
    if (!id.has(k)) id.set(k, parent.push(parent.length) - 1);
    return id.get(k);
  };
  for (const { tri } of tris) {
    const [a, b, c] = tri.map(node);
    parent[find(b)] = find(a);
    parent[find(c)] = find(a);
  }
  const votes = new Map();
  const area = (tri) => {
    const [p, q, r] = tri.map((i) => pos[i]);
    const u = [0, 1, 2].map((a) => q[a] - p[a]), v = [0, 1, 2].map((a) => r[a] - p[a]);
    return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
  };
  for (const t of tris) {
    t.piece = find(node(t.tri[0]));
    const v = votes.get(t.piece) || {};
    v[t.part] = (v[t.part] || 0) + area(t.tri);
    votes.set(t.piece, v);
  }
  for (const t of tris) {
    const v = votes.get(t.piece);
    t.part = Object.keys(v).reduce((a, b) => (v[a] >= v[b] ? a : b));
  }
}

// Every triangle of the model in world space, sorted into the three parts:
// { paint: { pos: [], nrm: [] }, ... }, three floats per vertex.
function sortTriangles(doc, bike) {
  const parts = Object.fromEntries(Object.keys(MATERIALS).map((k) => [k, { pos: [], nrm: [] }]));
  const samplers = new Map();
  const nodes = doc.getRoot().listNodes().filter((n) => n.getMesh());
  nodes.forEach((node, index) => {
    const m = node.getWorldMatrix();
    const point = (p) => [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    ];
    // Fine for the rotations and uniform scales these files use.
    const dir = (n) => {
      const v = [m[0] * n[0] + m[4] * n[1] + m[8] * n[2], m[1] * n[0] + m[5] * n[1] + m[9] * n[2], m[2] * n[0] + m[6] * n[1] + m[10] * n[2]];
      const l = Math.hypot(...v) || 1;
      return v.map((x) => x / l);
    };
    for (const prim of node.getMesh().listPrimitives()) {
      const P = prim.getAttribute("POSITION"), N = prim.getAttribute("NORMAL"), UV = prim.getAttribute("TEXCOORD_0");
      const idx = prim.getIndices();
      const count = idx ? idx.getCount() : P.getCount();
      const vi = (k) => (idx ? idx.getScalar(k) : k);
      const material = prim.getMaterial();
      const pos = Array.from({ length: P.getCount() }, (_, i) => point(P.getElement(i, [])));
      const nrm = N && Array.from({ length: N.getCount() }, (_, i) => dir(N.getElement(i, [])));
      // Wheels: how far out from the hub a point is, as a fraction of the tyre's
      // radius. A triangle with any corner on the tyre is tyre.
      let hub = null;
      const wheelAt = (c) => {
        if (!hub) {
          const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
          for (const p of pos) for (const a of [0, 1]) (lo[a] = Math.min(lo[a], p[a])), (hi[a] = Math.max(hi[a], p[a]));
          hub = { x: (lo[0] + hi[0]) / 2, y: (lo[1] + hi[1]) / 2, r: (hi[1] - lo[1]) / 2 };
        }
        return Math.hypot(c[0] - hub.x, c[1] - hub.y) / hub.r;
      };
      let sample = null;
      if (UV && material?.getBaseColorTexture()) {
        const key = material;
        if (!samplers.has(key)) samplers.set(key, sampler(material.getBaseColorTexture(), material.getMetallicRoughnessTexture()));
        sample = samplers.get(key);
      }
      const tris = [];
      for (let t = 0; t + 2 < count; t += 3) {
        const tri = [vi(t), vi(t + 1), vi(t + 2)];
        const c = [0, 1, 2].map((a) => (pos[tri[0]][a] + pos[tri[1]][a] + pos[tri[2]][a]) / 3);
        const part = bike.part({
          index,
          material: material?.getName(),
          wheel: () => Math.max(...tri.map((i) => wheelAt(pos[i]))),
          // The texture at the triangle's middle and corners, averaged.
          sample: () => {
            const uvs = tri.map((i) => UV.getElement(i, []));
            const pts = [...uvs, [0, 1].map((a) => (uvs[0][a] + uvs[1][a] + uvs[2][a]) / 3)];
            const s = pts.map(([u, v]) => sample(u, v));
            return [0, 1, 2, 3].map((a) => s.reduce((sum, x) => sum + x[a], 0) / s.length);
          },
        });
        tris.push({ tri, part });
      }
      if (bike.byPiece) byPiece(tris, pos);
      for (const { tri, part } of tris) {
        for (const i of tri) {
          parts[part].pos.push(...pos[i]);
          parts[part].nrm.push(...(nrm ? nrm[i] : [0, 1, 0]));
        }
      }
    }
  });
  return parts;
}

// New normals for triangles given as a flat list of corners: each corner
// takes the area-weighted average of the triangles meeting at its point
// that face within 50° of its own, so tubes come out smooth and sharp
// edges stay sharp.
function smoothNormals(pos) {
  const tris = pos.length / 9;
  const face = new Float64Array(tris * 3);
  const at = new Map(); // point -> triangles touching it
  for (let t = 0; t < tris; t++) {
    const o = t * 9;
    const u = [0, 1, 2].map((a) => pos[o + 3 + a] - pos[o + a]), v = [0, 1, 2].map((a) => pos[o + 6 + a] - pos[o + a]);
    face.set([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], t * 3); // length = 2 × area
    for (let c = 0; c < 3; c++) {
      const key = [0, 1, 2].map((a) => Math.round(pos[o + c * 3 + a] * 1e5)).join();
      if (!at.has(key)) at.set(key, []);
      at.get(key).push(t);
    }
  }
  const unit = (t) => {
    const l = Math.hypot(face[t * 3], face[t * 3 + 1], face[t * 3 + 2]) || 1;
    return [face[t * 3] / l, face[t * 3 + 1] / l, face[t * 3 + 2] / l];
  };
  const crease = Math.cos((50 * Math.PI) / 180);
  const out = new Array(pos.length);
  for (let t = 0; t < tris; t++) {
    const own = unit(t);
    for (let c = 0; c < 3; c++) {
      const o = t * 9 + c * 3;
      const key = [0, 1, 2].map((a) => Math.round(pos[o + a] * 1e5)).join();
      const n = [0, 0, 0];
      for (const other of at.get(key)) {
        const d = unit(other);
        if (d[0] * own[0] + d[1] * own[1] + d[2] * own[2] < crease) continue;
        for (let a = 0; a < 3; a++) n[a] += face[other * 3 + a];
      }
      const l = Math.hypot(...n) || 1;
      for (let a = 0; a < 3; a++) out[o + a] = n[a] / l;
    }
  }
  return out;
}

// Front along +x, on the ground, centred, real length.
function place(parts, bike) {
  const all = Object.values(parts).flatMap((p) => p.pos);
  if (bike.flip) {
    for (const p of Object.values(parts)) {
      for (const arr of [p.pos, p.nrm]) for (let i = 0; i < arr.length; i += 3) (arr[i] = -arr[i]), (arr[i + 2] = -arr[i + 2]);
    }
  }
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of Object.values(parts)) {
    for (let i = 0; i < p.pos.length; i += 3) for (let a = 0; a < 3; a++) (lo[a] = Math.min(lo[a], p.pos[i + a])), (hi[a] = Math.max(hi[a], p.pos[i + a]));
  }
  const s = bike.length / (hi[0] - lo[0]);
  const shift = [-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2];
  for (const p of Object.values(parts)) for (let i = 0; i < p.pos.length; i++) p.pos[i] = (p.pos[i] + shift[i % 3]) * s;
  return { size: [0, 1, 2].map((a) => +((hi[a] - lo[a]) * s).toFixed(3)), triangles: all.length / 9 };
}

// Adds the parts to `doc` (a new one if not given), one mesh each.
function build(parts, doc = new Document()) {
  const buffer = doc.getRoot().listBuffers()[0] || doc.createBuffer();
  const scene = doc.getRoot().listScenes()[0] || doc.createScene("bike");
  for (const [name, { pos, nrm }] of Object.entries(parts)) {
    if (!pos.length) continue;
    const { color, metallic, roughness } = MATERIALS[name];
    const material = doc.createMaterial(name).setBaseColorFactor([...color, 1]).setMetallicFactor(metallic).setRoughnessFactor(roughness);
    const prim = doc.createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(nrm)).setBuffer(buffer))
      .setMaterial(material);
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  }
  return doc;
}

const only = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.encoder": await draco3d.createEncoderModule(),
  "draco3d.decoder": await draco3d.createDecoderModule(),
});
await MeshoptSimplifier.ready;
await mkdir(OUT, { recursive: true });

for (const [name, bike] of Object.entries(BIKES)) {
  if (only.length && !only.includes(name)) continue;
  const src = await io.readBinary(new Uint8Array(await original(name, bike.uid)));
  const parts = sortTriangles(src, bike);
  const info = place(parts, bike);
  // The frame keeps every triangle: stickers are wrapped onto it.
  if (bike.smooth) for (const p of Object.values(parts)) p.nrm = smoothNormals(p.pos);
  const { paint, ...rest } = parts;
  const doc = build(rest);
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: bike.ratio, error: bike.error ?? 0.0005 }));
  build({ paint }, doc);
  await doc.transform(weld(), prune(), draco({ quantizePosition: 14 }));
  const glb = await io.writeBinary(doc);
  await writeFile(new URL(`${name}.glb`, OUT), glb);
  const tris = doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives()[0].getIndices().getCount() / 3, 0);
  console.log(`${name}: ${info.size.join(" × ")} m, ${info.triangles} → ${tris} triangles, ${(glb.byteLength / 1024).toFixed(0)} KB`);
}
