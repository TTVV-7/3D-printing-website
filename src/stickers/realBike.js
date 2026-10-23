// Real bike models (bikeModels.js) for the thermal maker's "show it on a
// bike" view, in the same shape as buildBike() (BikeScene.js) so
// StickerScene.js can use either: { group, tubes: { top, down, seat:
// { from, to, r } }, spec, centre, real: true }. Each tube's centre line and
// radius are measured from the model (BikeModelScene.js).
import { Box3, CircleGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { BIKE_MODELS } from "./bikeModels.js";
import { measureTube } from "./BikeModelScene.js";
import { BIKES } from "./bikes.js";

export const hasRealBike = (type) => BIKE_MODELS.some((b) => b.key === type);

const loaded = new Map(); // type -> Promise of the built bike, kept for reuse

export function loadRealBike(type) {
  if (!loaded.has(type)) loaded.set(type, build(type));
  return loaded.get(type);
}

// The sticker is bent to a circle, and real tubes are a little oval and
// tapered: use the widest the tube gets where the sticker goes (its middle
// third, the side facing the camera), plus a hair, so no part of the
// sticker dips under the paint.
function radius({ sections }) {
  let r = 0;
  const n = sections.length;
  for (const { dist } of sections.slice(Math.floor(n / 3), Math.ceil((2 * n) / 3))) {
    const front = dist.length >> 1, spread = Math.round(dist.length / 6); // ±60°
    for (let k = front - spread; k <= front + spread; k++) r = Math.max(r, dist[k]);
  }
  return r + 0.4;
}

async function build(type) {
  const model = BIKE_MODELS.find((b) => b.key === type);
  const draco = new DRACOLoader().setDecoderPath("/draco/");
  const { scene: root } = await new GLTFLoader().setDRACOLoader(draco).loadAsync(model.url);
  draco.dispose();
  root.scale.setScalar(1000); // metres to millimetres
  // The frame in the built bike's colour for this type, so switching between
  // a built and a real bike doesn't change it.
  const paintMat = new MeshPhysicalMaterial({ color: BIKES[type].colour, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  let paint = null;
  root.traverse((o) => {
    if (o.isMesh && o.material.name === "paint") {
      o.material = paintMat;
      paint = o;
    }
  });
  root.updateMatrixWorld(true);

  const lines = { top: model.tubes.top || model.step, down: model.tubes.down, seat: model.tubes.seat };
  const tubes = {};
  for (const [key, line] of Object.entries(lines)) {
    const m = measureTube(paint, line);
    tubes[key] = { from: m.a.clone(), to: m.a.clone().addScaledVector(m.dir, m.length), r: radius(m) };
  }

  const group = new Group();
  group.add(root);
  // A soft shadow under it, like the built bikes'.
  const box = new Box3().setFromObject(root);
  const centre = box.getCenter(new Vector3());
  const shadow = new Mesh(new CircleGeometry(1, 48), new MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set((box.max.x - box.min.x) / 2, 160, 1);
  shadow.position.set(centre.x, 0.5, 0);
  group.add(shadow);

  return { group, tubes, spec: BIKES[type], centre, real: true };
}
