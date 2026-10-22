// A bike built from tubes and wheels, in millimetres, for showing a sticker
// on a frame at its real size (StickerScene.js). Each type sets wheel size,
// tube thickness and frame geometry close to a typical medium-size bike;
// side view along x (forward), y up, the drive side towards +z.
import {
  Group, Mesh, MeshStandardMaterial, MeshPhysicalMaterial, CylinderGeometry, TorusGeometry, BoxGeometry,
  Vector3, Quaternion, BufferGeometry, Float32BufferAttribute, LineSegments, LineBasicMaterial, CircleGeometry,
} from "three";
import { BIKES } from "./bikes.js";

const deg = (d) => (d * Math.PI) / 180;
const UP = new Vector3(0, 1, 0);

// A cylinder from a to b.
function tube(a, b, r, material) {
  const len = a.distanceTo(b);
  const m = new Mesh(new CylinderGeometry(r, r, len, 28), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.copy(new Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
  return m;
}

function wheel(centre, spec, rubber, metal) {
  const g = new Group();
  const R = spec.wheel / 2, t = spec.tyre / 2;
  const tyre = new Mesh(new TorusGeometry(R - t, t, 16, 96), rubber);
  const rim = new Mesh(new TorusGeometry(R - spec.tyre - 6, 7, 10, 96), metal);
  const hub = new Mesh(new CylinderGeometry(18, 18, 100, 20), metal);
  hub.rotation.x = Math.PI / 2;
  // Spokes, laced to either hub flange.
  const pts = [];
  const n = spec.wheel > 600 ? 28 : 20, rr = R - spec.tyre - 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, side = i % 2 ? 1 : -1;
    pts.push(0, 0, side * 30, Math.cos(a) * rr, Math.sin(a) * rr, 0);
  }
  const sg = new BufferGeometry();
  sg.setAttribute("position", new Float32BufferAttribute(pts, 3));
  g.add(tyre, rim, hub, new LineSegments(sg, new LineBasicMaterial({ color: 0xb8bec8 })));
  g.position.copy(centre);
  return g;
}

// Builds `type`; returns the group and where a sticker can go on each tube
// ({ from, to, r }, sticker centred between them).
export function buildBike(type) {
  const s = BIKES[type] || BIKES.road;
  const paint = new MeshPhysicalMaterial({ color: s.colour, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  const metal = new MeshStandardMaterial({ color: 0x9aa3ae, roughness: 0.35, metalness: 0.8 });
  const dark = new MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.7 });
  const rubber = new MeshStandardMaterial({ color: 0x202226, roughness: 0.95 });
  const g = new Group();

  const wR = s.wheel / 2;
  const bb = new Vector3(0, wR - s.drop, 0);
  const rear = new Vector3(-Math.sqrt(s.cs * s.cs - s.drop * s.drop), wR, 0);
  const front = new Vector3(rear.x + s.wb, wR, 0);
  const htTop = bb.clone().add(new Vector3(s.reach, s.stack, 0));
  const htBot = htTop.clone().add(new Vector3(Math.cos(deg(s.hta)) * s.ht, -Math.sin(deg(s.hta)) * s.ht, 0));
  const stDir = new Vector3(-Math.cos(deg(s.sta)), Math.sin(deg(s.sta)), 0);
  const stTop = bb.clone().add(stDir.clone().multiplyScalar(s.st));
  // The top tube meets the head tube a little below its top.
  const ttFront = htTop.clone().lerp(htBot, 0.18);
  const ttRear = stTop.clone().sub(stDir.clone().multiplyScalar(25));

  const tubes = {
    top: { from: ttRear, to: ttFront, r: s.r.top },
    down: { from: bb, to: htBot.clone().lerp(htTop, 0.12), r: s.r.down },
    seat: { from: bb.clone().add(stDir.clone().multiplyScalar(60)), to: stTop, r: s.r.seat },
  };
  for (const t of Object.values(tubes)) g.add(tube(t.from, t.to, t.r, paint));
  g.add(tube(htBot, htTop, s.r.down + 3, paint));
  for (const z of [-55, 55]) {
    const r = rear.clone().setZ(z);
    g.add(tube(r, bb.clone().setZ(z * 0.6), 9, paint));
    g.add(tube(r, ttRear.clone().setZ(z * 0.4), 8, paint));
    // Fork legs.
    g.add(tube(htBot.clone().setZ(z * 0.5), front.clone().setZ(z * 0.9), type === "mountain" ? 18 : 12, type === "mountain" ? metal : paint));
  }
  // Shell, seatpost, saddle.
  const shell = new Mesh(new CylinderGeometry(22, 22, 75, 24), paint);
  shell.rotation.x = Math.PI / 2;
  shell.position.copy(bb);
  const postTop = stTop.clone().add(stDir.clone().multiplyScalar(type === "bmx" ? 60 : 170));
  const saddle = new Mesh(new BoxGeometry(260, 40, 130), dark);
  saddle.position.copy(postTop).add(new Vector3(10, 20, 0));
  g.add(shell, tube(stTop, postTop, 13, metal), saddle);

  // Stem and bars.
  const steerTop = htTop.clone().add(new Vector3(-Math.cos(deg(s.hta)) * 35, Math.sin(deg(s.hta)) * 35, 0));
  const stemEnd = steerTop.clone().add(new Vector3(s.bar === "riser" ? 50 : 100, s.bar === "riser" ? 40 : 5, 0));
  g.add(tube(htTop, steerTop, 16, dark), tube(steerTop, stemEnd, 15, dark));
  const half = s.bar === "drop" ? 210 : s.bar === "riser" ? 340 : 380;
  const barL = stemEnd.clone().setZ(-half), barR = stemEnd.clone().setZ(half);
  g.add(tube(barL, barR, 12, dark));
  if (s.bar === "drop") {
    for (const z of [-half, half]) {
      const a = stemEnd.clone().setZ(z);
      const b = a.clone().add(new Vector3(70, -40, 0));
      const c = b.clone().add(new Vector3(-20, -100, 0));
      g.add(tube(a, b, 12, dark), tube(b, c, 12, dark), tube(c, c.clone().add(new Vector3(-60, 0, 0)), 12, dark));
    }
  }
  if (s.bar === "riser") {
    for (const z of [-90, 90]) g.add(tube(stemEnd.clone().setZ(z), stemEnd.clone().add(new Vector3(0, 70, z)), 11, dark));
    g.add(tube(stemEnd.clone().add(new Vector3(0, 70, -half)), stemEnd.clone().add(new Vector3(0, 70, half)), 12, dark));
  }

  // Drivetrain: chainring, cranks, pedals.
  const ring = new Mesh(new CylinderGeometry(type === "bmx" ? 75 : 95, type === "bmx" ? 75 : 95, 4, 48), metal);
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(bb).setZ(48);
  g.add(ring);
  const crank = type === "kids" ? 120 : 170;
  for (const [z, a] of [[58, deg(-70)], [-58, deg(110)]]) {
    const end = bb.clone().add(new Vector3(Math.cos(a) * crank, Math.sin(a) * crank, z));
    g.add(tube(bb.clone().setZ(z), end, 10, dark));
    const pedal = new Mesh(new BoxGeometry(90, 18, 100), dark);
    pedal.position.copy(end).setZ(z + Math.sign(z) * 55);
    g.add(pedal);
  }

  g.add(wheel(rear, s, rubber, metal), wheel(front, s, rubber, metal));

  const shadow = new Mesh(new CircleGeometry(1, 48), new MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set((front.x - rear.x) / 2 + wR, 160, 1);
  shadow.position.set((front.x + rear.x) / 2, 0.5, 0);
  g.add(shadow);

  return { group: g, tubes, spec: s, centre: new Vector3((front.x + rear.x) / 2, wR, 0) };
}

// Wraps a flat sticker geometry (in its own x/y plane, thickness along +z)
// round a tube of radius `r` whose axis runs along x through the origin, so
// the sticker sits on the tube's +z side, curving over it.
export function bendAroundTube(geometry, r) {
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getZ(i);
    const a = y / r, rr = r + 0.15 + z;
    p.setY(i, Math.sin(a) * rr);
    p.setZ(i, Math.cos(a) * rr);
  }
  p.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}
