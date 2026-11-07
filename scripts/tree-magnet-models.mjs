// Builds the web copies of the PNW tree magnets shown on the 3D models page.
//
//   node scripts/tree-magnet-models.mjs ../Weave-Trial/pnw-tree-magnets/stl
//
// Reads each painted half-tree 3MF from the Weave-Trial repo (every triangle
// carries its filament as a Bambu/Orca `paint_color` code, which three.js's
// 3MF loader ignores) and writes public/models/trees/<tree>-magnet.glb:
//
// - each triangle coloured with its filament, from the 3MF's colour group
// - kept in mm and the way it's printed: flat back on z = 0, the tree standing
//   up along +y, its front facing +z (glTF is Y-up, so it stands on screen)
// - welded per colour, so simplifying keeps every colour border exactly where
//   the printer swaps filament, then Meshopt-compressed (well under 1 MB)
//
// Only needed again when the magnets in Weave-Trial change.
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { Document, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { meshopt, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { unzipSync, strFromU8 } from "three/examples/jsm/libs/fflate.module.js";

const OUT = new URL("../public/models/trees/", import.meta.url);
const SRC = process.argv[2];
if (!SRC) {
  console.error("usage: node scripts/tree-magnet-models.mjs <Weave-Trial>/pnw-tree-magnets/stl");
  process.exit(1);
}

// Bambu Studio / OrcaSlicer per-triangle codes for filaments 1-4 (unsplit).
const PAINT = { "4": 0, "8": 1, "0C": 2, "1C": 3 };
// Share of triangles kept: ~210k → ~30k still shows the bark and needles.
const RATIO = 0.15;
const ERROR = 0.002;

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function parse3mf(buf) {
  const files = unzipSync(new Uint8Array(buf));
  const name = Object.keys(files).find((f) => /^3D\/.*\.model$/i.test(f));
  const xml = strFromU8(files[name]);

  const colours = [...xml.matchAll(/<m:color color="#([0-9A-Fa-f]{6})/g)].map(([, h]) =>
    [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255)));

  const verts = [];
  for (const [, x, y, z] of xml.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)) verts.push(+x, +y, +z);

  const tris = [];
  const paint = [];
  for (const m of xml.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"(?: paint_color="([^"]*)")?/g)) {
    tris.push(+m[1], +m[2], +m[3]);
    const k = PAINT[m[4] ?? "4"];
    if (k === undefined) throw new Error(`unknown paint code ${m[4]}`);
    paint.push(k);
  }
  return { colours, verts, tris, paint };
}

// Smooth normals, shared by every vertex at the same spot whatever its colour,
// so the colour borders don't show up as creases in the shading. The flat back
// is kept apart (its corners get their own vertices), so it stays flat and the
// sharp edge around it stays sharp.
function smoothNormals(doc, prim) {
  const posIn = prim.getAttribute("POSITION").getArray();
  const colIn = prim.getAttribute("COLOR_0").getArray();
  const idx = prim.getIndices().getArray();
  const faceNormal = (i) => {
    const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]].map((v) => v * 3);
    const ux = posIn[b] - posIn[a], uy = posIn[b + 1] - posIn[a + 1], uz = posIn[b + 2] - posIn[a + 2];
    const vx = posIn[c] - posIn[a], vy = posIn[c + 1] - posIn[a + 1], vz = posIn[c + 2] - posIn[a + 2];
    // Its length is twice the face's area, so big faces count for more.
    return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  };
  const isBack = (n) => n[2] < -0.98 * Math.hypot(n[0], n[1], n[2]);

  // Copy each vertex once per side (front/back) that uses it.
  const remap = new Map();
  const pos = [], col = [], side = [];
  const newIdx = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i += 3) {
    const back = isBack(faceNormal(i)) ? 1 : 0;
    for (let j = 0; j < 3; j++) {
      const v = idx[i + j], k = v * 2 + back;
      if (!remap.has(k)) {
        remap.set(k, pos.length / 3);
        pos.push(posIn[v * 3], posIn[v * 3 + 1], posIn[v * 3 + 2]);
        col.push(colIn[v * 3], colIn[v * 3 + 1], colIn[v * 3 + 2]);
        side.push(back);
      }
      newIdx[i + j] = remap.get(k);
    }
  }

  const count = side.length;
  const spot = new Map();
  const spotOf = new Uint32Array(count);
  for (let v = 0; v < count; v++) {
    const k = `${side[v]}:${pos[v * 3].toFixed(4)},${pos[v * 3 + 1].toFixed(4)},${pos[v * 3 + 2].toFixed(4)}`;
    if (!spot.has(k)) spot.set(k, spot.size);
    spotOf[v] = spot.get(k);
  }
  const sum = new Float32Array(spot.size * 3);
  for (let i = 0; i < idx.length; i += 3) {
    const n = faceNormal(i);
    for (let j = 0; j < 3; j++) {
      const s = spotOf[newIdx[i + j]] * 3;
      sum[s] += n[0]; sum[s + 1] += n[1]; sum[s + 2] += n[2];
    }
  }
  const normal = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    const s = spotOf[v] * 3;
    const len = Math.hypot(sum[s], sum[s + 1], sum[s + 2]) || 1;
    normal.set([sum[s] / len, sum[s + 1] / len, sum[s + 2] / len], v * 3);
  }
  const buffer = doc.getRoot().listBuffers()[0];
  const attr = (array) => doc.createAccessor().setType("VEC3").setArray(array).setBuffer(buffer);
  prim.setAttribute("POSITION", attr(new Float32Array(pos)))
    .setAttribute("COLOR_0", attr(new Float32Array(col)))
    .setAttribute("NORMAL", attr(normal))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(newIdx).setBuffer(buffer));
}

async function build(file) {
  const { colours, verts, tris, paint } = parse3mf(await readFile(file));

  // One vertex per triangle corner, coloured by its triangle; weld() then
  // merges corners that share a position and a colour.
  const n = tris.length;
  const position = new Float32Array(n * 3);
  const colour = new Float32Array(n * 3);
  for (let t = 0; t < n / 3; t++) {
    const c = colours[paint[t]];
    for (let j = 0; j < 3; j++) {
      const i = t * 3 + j, v = tris[i];
      position.set(verts.slice(v * 3, v * 3 + 3), i * 3);
      colour.set(c, i * 3);
    }
  }

  const doc = new Document();
  const buffer = doc.createBuffer();
  const material = doc.createMaterial("matte PLA").setRoughnessFactor(0.75).setMetallicFactor(0);
  const prim = doc.createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(position).setBuffer(buffer))
    .setAttribute("COLOR_0", doc.createAccessor().setType("VEC3").setArray(colour).setBuffer(buffer))
    .setMaterial(material);
  const mesh = doc.createMesh("magnet").addPrimitive(prim);
  doc.createScene().addChild(doc.createNode("magnet").setMesh(mesh));

  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: ERROR, lockBorder: true }),
  );
  smoothNormals(doc, prim);
  const after = prim.getIndices().getCount() / 3;
  await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  return { glb: await io.writeBinary(doc), before: n / 3, after };
}

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
await mkdir(OUT, { recursive: true });
for (const f of (await readdir(SRC)).filter((f) => f.endsWith("-half.3mf")).sort()) {
  const tree = f.replace(/-half\.3mf$/, "");
  const { glb, before, after } = await build(`${SRC}/${f}`);
  await writeFile(new URL(`${tree}-magnet.glb`, OUT), glb);
  console.log(`${tree}: ${before} → ${after} triangles, ${(glb.byteLength / 1e6).toFixed(2)} MB`);
}
