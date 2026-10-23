// three.js stage for the bike stickers: a real-size bike (bikeModels.js) with the
// sticker wrapped around one of its tubes. Everything is in millimetres.
//
// Wrapping: each tube's real centre line is found from the model, then its
// cross-section is measured all the way round at points along it (rays from
// the centre out to the tube wall). The sticker is laid on that surface by
// arc length, so it follows round, oval and aero tubes alike without
// stretching.
import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, NeutralToneMapping, SRGBColorSpace,
  DirectionalLight, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, CircleGeometry, CanvasTexture,
  BufferGeometry, BufferAttribute, Float32BufferAttribute, Raycaster, Vector3, Box3, Color,
  DoubleSide, PCFShadowMap, ShadowMaterial,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { bikeOf } from "./bikeModels.js";

const SIDE = new Vector3(0, 0, 1); // the side of the bike the camera starts on
const REACH = 45; // mm: no tube is wider than this from its centre
const AROUND = 96; // samples round each cross-section
const ALONG = 41; // cross-sections along each tube
const LIFT = 0.25; // mm the sticker sits off the paint

const FINISH = {
  gloss: { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 },
  matte: { roughness: 0.85, clearcoat: 0, clearcoatRoughness: 0 },
};

// The paint triangles within reach of a tube, as their own mesh: rays are
// only ever cast at these, which keeps measuring quick.
function nearTube(paint, a, b) {
  const geo = paint.geometry;
  const pos = geo.attributes.position;
  const idx = geo.index;
  const m = paint.matrixWorld;
  const ab = b.clone().sub(a);
  const len2 = ab.lengthSq();
  const out = [];
  const p = [new Vector3(), new Vector3(), new Vector3()];
  const c = new Vector3();
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i < n; i += 3) {
    for (let k = 0; k < 3; k++) p[k].fromBufferAttribute(pos, idx ? idx.getX(i + k) : i + k).applyMatrix4(m);
    c.copy(p[0]).add(p[1]).add(p[2]).divideScalar(3);
    const t = Math.min(1.1, Math.max(-0.1, c.clone().sub(a).dot(ab) / len2));
    if (c.distanceTo(a.clone().addScaledVector(ab, t)) < REACH * 1.6) for (const q of p) out.push(q.x, q.y, q.z);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(out, 3));
  return new Mesh(g, new MeshStandardMaterial({ side: DoubleSide }));
}

// The tube's centre line, its usable length, and cross-sections along it.
function measureTube(paint, line) {
  let a = new Vector3(line[0][0] * 1000, line[0][1] * 1000, 0);
  let b = new Vector3(line[1][0] * 1000, line[1][1] * 1000, 0);
  const near = nearTube(paint, a, b);
  const ray = new Raycaster();
  const hit = (origin, dir, far) => {
    ray.set(origin, dir);
    ray.far = far;
    return ray.intersectObject(near, false)[0] || null;
  };

  // Centre: halfway between the walls, top to bottom and side to side.
  let dir = b.clone().sub(a).normalize();
  let up = new Vector3(-dir.y, dir.x, 0);
  const mids = [];
  for (let i = 1; i < 20; i++) {
    const t = i / 20;
    const p = a.clone().lerp(b, t);
    const walls = [up, SIDE].map((d) => {
      const hi = hit(p.clone().addScaledVector(d, REACH), d.clone().negate(), REACH * 2);
      const lo = hit(p.clone().addScaledVector(d, -REACH), d, REACH * 2);
      return hi && lo && (hi.point.clone().sub(p).dot(d) + lo.point.clone().sub(p).dot(d)) / 2;
    });
    if (walls.every((w) => w !== null && w !== undefined)) {
      mids.push({ t, c: p.addScaledVector(up, walls[0]).setZ(walls[1]) });
    }
  }
  if (mids.length >= 2) {
    // A straight line through the centres, least squares in t.
    const mt = mids.reduce((s, m) => s + m.t, 0) / mids.length;
    const mc = mids.reduce((s, m) => s.add(m.c), new Vector3()).divideScalar(mids.length);
    const slope = mids
      .reduce((s, m) => s.addScaledVector(m.c.clone().sub(mc), m.t - mt), new Vector3())
      .divideScalar(mids.reduce((s, m) => s + (m.t - mt) ** 2, 0));
    const t0 = mids[0].t, t1 = mids[mids.length - 1].t;
    [a, b] = [mc.clone().addScaledVector(slope, t0 - mt), mc.clone().addScaledVector(slope, t1 - mt)];
  }
  dir = b.clone().sub(a).normalize();
  const side = SIDE.clone().addScaledVector(dir, -SIDE.dot(dir)).normalize();
  up = side.clone().cross(dir);
  const length = a.distanceTo(b);

  // Cross-sections: distance to the wall at each angle (0 = facing the
  // camera side, + towards the top), and the arc length round to it.
  const sections = [];
  for (let i = 0; i < ALONG; i++) {
    const centre = a.clone().addScaledVector(dir, (length * i) / (ALONG - 1));
    const dist = [];
    for (let k = 0; k <= AROUND; k++) {
      const th = -Math.PI + (2 * Math.PI * k) / AROUND;
      const r = side.clone().multiplyScalar(Math.cos(th)).addScaledVector(up, Math.sin(th));
      dist.push(hit(centre, r, REACH)?.distance ?? NaN);
    }
    // Gaps (a cable port, a weld) take the nearest measurement.
    const ok = dist.filter((d) => !Number.isNaN(d));
    const fallback = ok.length ? ok.sort((x, y) => x - y)[ok.length >> 1] : 15;
    for (let k = 0; k <= AROUND; k++) {
      if (!Number.isNaN(dist[k])) continue;
      let j = 1;
      while (j < AROUND && Number.isNaN(dist[(k + j) % AROUND]) && Number.isNaN(dist[(k - j + AROUND) % AROUND])) j++;
      const x = dist[(k + j) % AROUND], y = dist[(k - j + AROUND) % AROUND];
      dist[k] = Number.isNaN(x) ? (Number.isNaN(y) ? fallback : y) : x;
    }
    dist[AROUND] = dist[0];
    const arc = [0];
    for (let k = 1; k <= AROUND; k++) {
      const step = (2 * Math.PI) / AROUND;
      const r0 = dist[k - 1], r1 = dist[k];
      arc.push(arc[k - 1] + Math.sqrt(r0 * r0 + r1 * r1 - 2 * r0 * r1 * Math.cos(step)));
    }
    const zero = arc[AROUND / 2];
    sections.push({ dist, arc: arc.map((s) => s - zero), round: arc[AROUND] });
  }
  return { a, dir, up, side, length, sections };
}

// Angle and distance to the wall on one cross-section, for a point `v` mm
// round from the side facing the camera (wrapping on past a full turn).
function onSection(sec, v) {
  const lo = sec.arc[0];
  const turns = Math.floor((v - lo) / sec.round);
  const s = v - turns * sec.round;
  let k = 0;
  while (k < AROUND - 1 && sec.arc[k + 1] < s) k++;
  const f = (s - sec.arc[k]) / (sec.arc[k + 1] - sec.arc[k] || 1);
  const th = -Math.PI + ((2 * Math.PI) / AROUND) * (k + f) + turns * 2 * Math.PI;
  return { th, d: sec.dist[k] + (sec.dist[k + 1] - sec.dist[k]) * f };
}

// The sticker as a grid laid round the tube. `at` is where its middle sits
// along the usable length (0-1); `turn` (radians) turns it round the tube.
function wrap(tube, { w, h, at, turn }) {
  const nu = Math.max(24, Math.ceil(w / 1.5)), nv = Math.max(16, Math.ceil(h / 1.2));
  const free = Math.max(0, tube.length - w);
  const mid = (tube.length - free) / 2 + free * at;
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  const uv = new Float32Array((nu + 1) * (nv + 1) * 2);
  const p = new Vector3(), r = new Vector3();
  // The arc length the turn moves through, measured on the middle section.
  const midSec = tube.sections[Math.round((mid / tube.length) * (ALONG - 1))];
  const turnArc = onArc(midSec, turn);
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const s = mid - w / 2 + (w * i) / nu;
      const v = turnArc + h / 2 - (h * j) / nv;
      const x = Math.min(ALONG - 1, Math.max(0, (s / tube.length) * (ALONG - 1)));
      const k = Math.min(ALONG - 2, Math.floor(x)), f = x - k;
      const A = onSection(tube.sections[k], v), B = onSection(tube.sections[k + 1], v);
      const th = A.th + (B.th - A.th) * f, d = A.d + (B.d - A.d) * f + LIFT;
      r.copy(tube.side).multiplyScalar(Math.cos(th)).addScaledVector(tube.up, Math.sin(th));
      p.copy(tube.a).addScaledVector(tube.dir, s).addScaledVector(r, d);
      const o = j * (nu + 1) + i;
      pos.set([p.x, p.y, p.z], o * 3);
      uv.set([i / nu, 1 - j / nv], o * 2);
    }
  }
  const index = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const o = j * (nu + 1) + i;
      index.push(o, o + nu + 1, o + 1, o + 1, o + nu + 1, o + nu + 2);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setAttribute("uv", new BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  // Its middle, and which way is out from the tube there.
  const c = onSection(midSec, turnArc);
  r.copy(tube.side).multiplyScalar(Math.cos(c.th)).addScaledVector(tube.up, Math.sin(c.th));
  return { geo, centre: tube.a.clone().addScaledVector(tube.dir, mid).addScaledVector(r, c.d), normal: r.clone() };
}

// Arc length from the camera side to angle `th` on a cross-section.
function onArc(sec, th) {
  const x = ((th + Math.PI) / (2 * Math.PI)) * AROUND;
  const k = Math.min(AROUND - 1, Math.max(0, Math.floor(x)));
  return sec.arc[k] + (sec.arc[k + 1] - sec.arc[k]) * (x - k);
}

function floorTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  grad.addColorStop(0, "#1d3048");
  grad.addColorStop(1, "#0c1a2e");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  return c;
}

export async function mountBike(canvas, { reducedMotion }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setClearColor(0x0c1a2e);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const key = new DirectionalLight(0xffffff, 1.8);
  key.position.set(-600, 2400, 1400);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -1200, right: 1200, top: 1200, bottom: -1200, near: 100, far: 6000 });
  key.shadow.radius = 6;
  scene.add(key);

  const floorTex = new CanvasTexture(floorTexture());
  floorTex.colorSpace = SRGBColorSpace;
  const floor = new Mesh(new CircleGeometry(2600, 64), new MeshStandardMaterial({ map: floorTex, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const shade = new Mesh(new CircleGeometry(2600, 64), new ShadowMaterial({ opacity: 0.35 }));
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.5;
  shade.receiveShadow = true;
  scene.add(shade);

  const camera = new PerspectiveCamera(32, 1, 5, 20000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 120;
  controls.maxDistance = 4500;
  controls.addEventListener("start", () => (glide = null));

  // One paint for every bike, so the colour carries over when switching.
  const paintMat = new MeshPhysicalMaterial({ color: 0xc8102e, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });

  const draco = new DRACOLoader().setDecoderPath("/draco/");
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const bikes = new Map(); // key -> Promise<{ root, paint, tubes: {} }>
  function load(key) {
    if (!bikes.has(key)) {
      bikes.set(key, loader.loadAsync(bikeOf(key).url).then(({ scene: root }) => {
        root.scale.setScalar(1000);
        let paint = null;
        root.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          if (o.material.name === "paint") {
            o.material = paintMat;
            paint = o;
          }
        });
        root.updateMatrixWorld(true);
        return { root, paint, tubes: {} };
      }));
    }
    return bikes.get(key);
  }

  let bike = null; // the one on screen
  let opts = null; // the last setSticker()
  let sticker = null, stickerTex = null;
  let focus = null; // where the sticker is: { centre, normal }
  const stickerMat = new MeshPhysicalMaterial({
    alphaTest: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    ...FINISH.gloss,
  });

  function placeSticker() {
    if (!bike || !opts) return;
    if (sticker) {
      scene.remove(sticker);
      sticker.geometry.dispose();
      sticker = null;
    }
    const line = bikeOf(bike.key).tubes[opts.tube] || Object.values(bikeOf(bike.key).tubes)[0];
    const tubeKey = bikeOf(bike.key).tubes[opts.tube] ? opts.tube : Object.keys(bikeOf(bike.key).tubes)[0];
    bike.tubes[tubeKey] ||= measureTube(bike.paint, line);
    const { geo, centre, normal } = wrap(bike.tubes[tubeKey], opts);
    sticker = new Mesh(geo, stickerMat);
    sticker.castShadow = true;
    scene.add(sticker);
    focus = { centre, normal, w: opts.w };
  }

  // Eases the camera to a new spot; any drag cancels it.
  let glide = null;
  function lookAt(target, position, instant) {
    if (instant || reducedMotion) {
      controls.target.copy(target);
      camera.position.copy(position);
      glide = null;
    } else {
      glide = { start: performance.now(), from: [controls.target.clone(), camera.position.clone()], to: [target, position] };
    }
  }

  let view = "sticker";
  function frame(instant) {
    if (!bike) return;
    const aspect = camera.aspect || 1;
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    if (view === "bike" || !focus) {
      const box = new Box3().setFromObject(bike.root);
      const c = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      const dist = Math.max(size.x / 2 / (tan * aspect), size.y / 2 / tan) * 1.3;
      lookAt(c, c.clone().add(new Vector3(0.25, 0.18, 1).normalize().multiplyScalar(dist)), instant);
    } else {
      // Square on to the sticker, a little above, with the bike around it.
      const reach = Math.max(focus.w, 60) * 1.9;
      const dist = Math.max(reach / 2 / (tan * aspect), reach / 2 / tan);
      const dir = focus.normal.clone().setY(Math.max(focus.normal.y, 0) + 0.25).normalize();
      lookAt(focus.centre, focus.centre.clone().addScaledVector(dir, dist), instant);
    }
  }

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(() => {
    resize();
    frame(true);
  });
  ro.observe(canvas);
  resize();

  let raf = 0;
  const tick = () => {
    if (glide) {
      const t = Math.min(1, (performance.now() - glide.start) / 700);
      const e = 1 - (1 - t) ** 3;
      controls.target.lerpVectors(glide.from[0], glide.to[0], e);
      camera.position.lerpVectors(glide.from[1], glide.to[1], e);
      if (t === 1) glide = null;
    }
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  let wanted = null;
  return {
    // Shows another bike (loading it the first time), sticker and all.
    async setBike(key) {
      wanted = key;
      const next = await load(key);
      if (wanted !== key) return;
      const first = !bike;
      if (bike) scene.remove(bike.root);
      bike = Object.assign(next, { key });
      scene.add(bike.root);
      placeSticker();
      frame(first);
    },
    setPaint(hex) {
      paintMat.color.set(hex);
      // Pale and metallic-looking frames want less clearcoat sheen.
      const c = new Color(hex);
      paintMat.metalness = hex === "#9aa1ab" ? 0.8 : 0;
      paintMat.roughness = c.getHSL({}).l > 0.85 ? 0.45 : 0.35;
    },
    // `art`: the sticker's canvas (transparent outside its cut); w × h in mm,
    // w running along the tube. tube: "top" | "down"; at: 0-1 along it;
    // turn: radians round it; finish: "gloss" | "matte".
    setSticker({ art, w, h, tube, at = 0.5, turn = 0, finish = "gloss" }, refocus) {
      const moved = !opts || opts.tube !== tube || refocus;
      opts = { w, h, tube, at, turn };
      stickerTex?.dispose();
      stickerTex = new CanvasTexture(art);
      stickerTex.colorSpace = SRGBColorSpace;
      stickerTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      stickerMat.map = stickerTex;
      Object.assign(stickerMat, FINISH[finish]);
      stickerMat.needsUpdate = true;
      placeSticker();
      if (moved && view === "sticker") frame();
    },
    view(v) {
      view = v;
      frame();
    },
    start() {
      if (!raf) tick();
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      stickerTex?.dispose();
      floorTex.dispose();
      draco.dispose();
      renderer.dispose();
    },
  };
}
