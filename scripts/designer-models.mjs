// Builds the spinning models in the "Design your own" section.
//
//   node scripts/designer-models.mjs
//
// Asks the live generator app (3D-print-sandbox) for its on-screen preview of
// each sample, then writes one small GLB per sample to public/models/designer.
// The preview is a binary STL of every colour slot of every part plus a JSON
// header saying which triangles belong to which slot and where each part sits
// in the assembled object. Only needed again when the samples change.
import { writeFile, mkdir } from "node:fs/promises";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { site } from "../site.config.js";

const OUT = new URL("../public/models/designer/", import.meta.url);

// Colours per slot: body, pattern, primary, secondary. Picked to match the
// photos on the cards. `glow` slots are drawn lit (the sign's letters).
const SAMPLES = {
  fob: {
    params: { kind: "fob", name: "Jane Doe", company: "Bluewater Realty", phone: "(555) 214-8890" },
    colours: ["#1c1d21", "#3a3c42", "#f4f4f2", "#aab3bd"],
  },
  name: {
    params: { kind: "name", name: "Freddie" },
    colours: ["#f4f4f2", "#f4f4f2", "#2fae4f", "#2fae4f"],
  },
  sign: {
    params: { kind: "sign", name: "OPEN" },
    colours: ["#1f2126", "#1f2126", "#fff1d0", "#fff1d0"],
    glow: [2],
    back: true, // prints face down: turn it round to face the viewer
  },
  stencil: {
    params: { kind: "stencil", name: "SHOP" },
    colours: ["#d8392b", "#d8392b", "#d8392b", "#d8392b"],
  },
};

async function fetchPreview(params) {
  const res = await fetch(`${site.designerUrl}/api/model`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`${params.kind}: ${res.status} ${await res.text()}`);
  const info = JSON.parse(res.headers.get("x-card-info"));
  return { stl: Buffer.from(await res.arrayBuffer()), info };
}

// Triangles of each colour slot, in assembled position, centred. The
// printer's Z (out of the face) becomes the viewer's, so the face looks at you.
function slotGeometries({ stl, info }, { back = false }) {
  const count = stl.readUInt32LE(80);
  const read = (t, v) => {
    const o = 84 + t * 50 + 12 + v * 12;
    return new THREE.Vector3(stl.readFloatLE(o), stl.readFloatLE(o + 4), stl.readFloatLE(o + 8));
  };
  const bySlot = new Map();
  let t = 0;
  for (const part of info.preview) {
    const m = new THREE.Matrix4().set(...part.assembled);
    for (const [slot, , , n] of part.slots) {
      if (part.tag) { t += n; continue; } // the NFC tag sits hidden inside
      const list = bySlot.get(slot) ?? [];
      for (let i = 0; i < n; i++, t++)
        for (let v = 0; v < 3; v++) {
          const p = read(t, v).applyMatrix4(m);
          if (back) list.push(-p.x, p.y, -p.z);
          else list.push(p.x, p.y, p.z);
        }
      bySlot.set(slot, list);
    }
  }
  if (t !== count) throw new Error(`triangle count mismatch: ${t} vs ${count}`);

  const geoms = [...bySlot].map(([slot, list]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(list, 3));
    return { slot, geometry: mergeVertices(g, 1e-4) };
  });
  const box = new THREE.Box3();
  for (const { geometry } of geoms) { geometry.computeBoundingBox(); box.union(geometry.boundingBox); }
  const centre = box.getCenter(new THREE.Vector3()).negate();
  for (const { geometry } of geoms) geometry.translate(centre.x, centre.y, centre.z);
  return geoms;
}

// A minimal GLB: one node and mesh per slot, positions + indices only. The
// viewer shades flat, so no normals are stored.
function glb(geoms, { colours, glow = [] }) {
  const chunks = [], bufferViews = [], accessors = [], meshes = [], materials = [], nodes = [];
  let offset = 0;
  const push = (typed, target) => {
    const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (buf.length % 4)) % 4;
    chunks.push(buf, Buffer.alloc(pad));
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target });
    offset += buf.length + pad;
    return bufferViews.length - 1;
  };
  const rgb = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.2);

  for (const { slot, geometry } of geoms) {
    const pos = geometry.attributes.position.array;
    const idx = geometry.index.array;
    const small = pos.length / 3 < 65536;
    geometry.computeBoundingBox();
    accessors.push({
      bufferView: push(new Float32Array(pos), 34962), componentType: 5126, count: pos.length / 3, type: "VEC3",
      min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray(),
    });
    accessors.push({
      bufferView: push(small ? new Uint16Array(idx) : new Uint32Array(idx), 34963),
      componentType: small ? 5123 : 5125, count: idx.length, type: "SCALAR",
    });
    const lit = glow.includes(slot);
    materials.push({
      name: lit ? "glow" : `slot${slot}`,
      pbrMetallicRoughness: { baseColorFactor: [...rgb(colours[slot]), 1], metallicFactor: 0, roughnessFactor: 0.55 },
      ...(lit ? { emissiveFactor: rgb(colours[slot]) } : {}),
    });
    meshes.push({ primitives: [{ attributes: { POSITION: accessors.length - 2 }, indices: accessors.length - 1, material: materials.length - 1 }] });
    nodes.push({ mesh: meshes.length - 1 });
  }

  const bin = Buffer.concat(chunks);
  const json = {
    asset: { version: "2.0", generator: "printyours designer-models" },
    scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes, meshes, materials, accessors, bufferViews, buffers: [{ byteLength: bin.length }],
  };
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const chunk = (type, data) => {
    const h = Buffer.alloc(8); h.writeUInt32LE(data.length, 0); h.writeUInt32LE(type, 4);
    return Buffer.concat([h, data]);
  };
  return Buffer.concat([header, chunk(0x4e4f534a, js), chunk(0x004e4942, bin)]);
}

await mkdir(OUT, { recursive: true });
for (const [key, sample] of Object.entries(SAMPLES)) {
  const data = glb(slotGeometries(await fetchPreview(sample.params), sample), sample);
  await writeFile(new URL(`${key}.glb`, OUT), data);
  console.log(`${key}.glb  ${(data.length / 1024).toFixed(0)} kB`);
}
