// Builds the web copies of the construction models shown on the 3D models page.
//
//   node scripts/construction-models.mjs <Weave-Trial checkout> [git ref]
//   node scripts/construction-models.mjs ../Weave-Trial origin/claude/zen-darwin-fzhu3j
//
// Reads every GLB in construction_site/ and railbridge/ at that ref (sets 2-4
// live on a branch, not on Weave-Trial's default branch, which is all the
// page could otherwise reach) and writes public/models/construction/<stem>.glb:
//
// - parts that share a colour merged into one mesh: a few draw calls instead
//   of hundreds (the 50 ft fence run has 1,272 parts)
// - lightly simplified, never past ERROR of the model's size, so rails, rods
//   and lettering keep their shape
// - scaled from metres to millimetres at 1:50, the scale they're printed at,
//   so the viewer's "About W × D × H mm" is the size of the print
// - Meshopt-compressed
//
// Only needed again when the models in Weave-Trial change.
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, join, meshopt, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const OUT = new URL("../public/models/construction/", import.meta.url);
const [repo, ref = "HEAD"] = process.argv.slice(2);
if (!repo) {
  console.error("usage: node scripts/construction-models.mjs <Weave-Trial checkout> [git ref]");
  process.exit(1);
}

const SCALE = 1000 / 50; // metres → mm at 1:50
const RATIO = 0.5;
const ERROR = 0.0004;

const git = (...args) => execFileSync("git", ["-C", repo, ...args], { maxBuffer: 1 << 30 });
const files = git("ls-tree", "-r", "--name-only", "--full-tree", ref, "construction_site", "railbridge")
  .toString().split("\n").filter((f) => /^(construction_site|railbridge)\/[^/]+\.glb$/.test(f));

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
await mkdir(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });

const tris = (doc) => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
  .reduce((s, p) => s + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute("POSITION").getCount()) / 3, 0);

for (const file of files) {
  const stem = file.split("/").pop().replace(/\.glb$/, "");
  const doc = await io.readBinary(new Uint8Array(git("show", `${ref}:${file}`)));
  doc.setLogger({ debug() {}, info() {}, warn() {}, error: console.error });
  const before = tris(doc);

  await doc.transform(
    dedup(),
    flatten(),
    join({ keepNamed: false }),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: ERROR }),
  );

  // 1:50 in mm, under one parent so the parts keep their places.
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  const root = doc.createNode("1:50 mm").setScale([SCALE, SCALE, SCALE]);
  for (const child of scene.listChildren()) root.addChild(child);
  scene.addChild(root);

  const after = tris(doc);
  await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const glb = await io.writeBinary(doc);
  await writeFile(new URL(`${stem}.glb`, OUT), glb);
  console.log(`${stem}: ${before} → ${after} triangles, ${(glb.byteLength / 1e6).toFixed(2)} MB`);
}
