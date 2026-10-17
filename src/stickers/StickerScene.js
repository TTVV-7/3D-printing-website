// three.js stage for the sticker page: the sticker lying on a cutting mat
// with a 1 cm grid and a credit card beside it, so the size reads at a
// glance. Everything is in millimetres.
import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, NeutralToneMapping, SRGBColorSpace,
  DirectionalLight, Shape, ExtrudeGeometry, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  PlaneGeometry, CanvasTexture, NearestFilter, Group,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const CARD = { w: 85.6, h: 53.98, t: 0.76 };
const STICKER_T = 0.35; // a label and its backing, a touch thick so the edge shows
const GAP = 14;

const FINISH = {
  matte: { roughness: 0.9, clearcoat: 0, clearcoatRoughness: 1 },
  glossy: { roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.04 },
};

function outline(w, h, shape) {
  const s = new Shape();
  if (shape === "circle") {
    s.absarc(0, 0, w / 2, 0, Math.PI * 2, false);
    return s;
  }
  const r = shape === "rounded" ? Math.min(w, h) * 0.12 : shape === "card" ? 3.18 : 0.6;
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// A flat slab of the outline, lying on the table, its top at `t`.
function slab(w, h, t, shape, topMaterial, edgeMaterial) {
  const geo = new ExtrudeGeometry(outline(w, h, shape), { depth: t, bevelEnabled: false, curveSegments: 48 });
  geo.rotateX(-Math.PI / 2);
  return new Mesh(geo, [topMaterial, edgeMaterial]);
}

function matTexture() {
  const px = 8; // per mm
  const size = 400; // mm
  const c = document.createElement("canvas");
  c.width = c.height = size * px;
  const g = c.getContext("2d");
  g.fillStyle = "#2f6b4f";
  g.fillRect(0, 0, c.width, c.height);
  for (let mm = 0; mm <= size; mm += 5) {
    const major = mm % 10 === 0;
    g.strokeStyle = major ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.12)";
    g.lineWidth = major ? 3 : 2;
    const p = mm * px;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, c.height); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(c.width, p); g.stroke();
  }
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.font = `${4 * px}px ui-monospace, monospace`;
  for (let cm = 1; cm < size / 10; cm++) g.fillText(String(cm), cm * 10 * px + 6, 5 * px);
  return c;
}

function cardTexture() {
  const px = 8;
  const c = document.createElement("canvas");
  c.width = Math.round(CARD.w * px);
  c.height = Math.round(CARD.h * px);
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, "#1d3a5c");
  grad.addColorStop(1, "#0c1a2e");
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#d9b45a";
  g.beginPath();
  g.roundRect(9 * px, 18 * px, 11 * px, 8.5 * px, 1.4 * px);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.font = `600 ${4.2 * px}px ui-monospace, monospace`;
  g.fillText("•••• •••• •••• 4242", 9 * px, 38 * px);
  g.font = `${3 * px}px ui-sans-serif, system-ui`;
  g.fillStyle = "rgba(255,255,255,0.5)";
  g.fillText("Credit card for scale · 85.6 × 54 mm", 9 * px, 47 * px);
  return c;
}

// The extruded caps carry UVs in millimetres around the centre; map the
// sticker's canvas onto [-w/2, w/2] × [-h/2, h/2].
function fitTexture(tex, w, h) {
  tex.repeat.set(1 / w, 1 / h);
  tex.offset.set(0.5, 0.5);
  tex.needsUpdate = true;
}

export async function mountStickers(canvas, { reducedMotion }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.setClearColor(0x0c1a2e);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(-60, 160, 90);
  scene.add(key);

  const camera = new PerspectiveCamera(35, 1, 1, 4000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.45;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.4;
  controls.addEventListener("start", () => (controls.autoRotate = false));

  const matTex = new CanvasTexture(matTexture());
  matTex.colorSpace = SRGBColorSpace;
  matTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mat = new Mesh(
    new PlaneGeometry(400, 400),
    new MeshStandardMaterial({ map: matTex, roughness: 0.95 }),
  );
  mat.rotation.x = -Math.PI / 2;
  scene.add(mat);

  const cardTex = new CanvasTexture(cardTexture());
  cardTex.colorSpace = SRGBColorSpace;
  fitTexture(cardTex, CARD.w, CARD.h);
  const card = slab(
    CARD.w, CARD.h, CARD.t, "card",
    new MeshPhysicalMaterial({ map: cardTex, roughness: 0.4, clearcoat: 0.6 }),
    new MeshStandardMaterial({ color: 0x132842, roughness: 0.6 }),
  );
  scene.add(card);

  const group = new Group();
  scene.add(group);
  let sticker = null, stickerTex = null;
  const topMat = new MeshPhysicalMaterial({ roughness: 0.9 });
  const edgeMat = new MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.8 });

  let size = { w: 60, h: 60 };

  function frame() {
    const { clientWidth: cw, clientHeight: ch } = canvas;
    const span = size.w + GAP + CARD.w;
    const deep = Math.max(size.h, CARD.h);
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const fitW = span / 2 / (tan * (cw / ch || 1));
    const fitH = deep / 2 / tan;
    const dist = Math.max(fitW, fitH) * 1.35;
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1) dir.set(0, 0.85, 0.75);
    controls.target.set(0, 0, 0);
    camera.position.copy(dir.normalize().multiplyScalar(dist));
    controls.minDistance = dist * 0.35;
    controls.maxDistance = dist * 2.2;
    camera.near = dist / 50;
    camera.far = dist * 10;
    camera.updateProjectionMatrix();
  }

  function layout() {
    const span = size.w + GAP + CARD.w;
    const left = -span / 2;
    group.position.set(left + size.w / 2, 0, 0);
    card.position.set(left + size.w + GAP + CARD.w / 2, 0, 0);
  }

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    frame();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  let raf = 0;
  const tick = () => {
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  return {
    // `art` is the canvas from renderThermal().
    update({ art, w, h, shape, finish, paper }) {
      const resized = w !== size.w || h !== size.h;
      size = { w, h };
      if (sticker) {
        group.remove(sticker);
        sticker.geometry.dispose();
      }
      stickerTex?.dispose();
      stickerTex = new CanvasTexture(art);
      stickerTex.colorSpace = SRGBColorSpace;
      stickerTex.magFilter = NearestFilter;
      stickerTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      fitTexture(stickerTex, w, h);
      topMat.map = stickerTex;
      Object.assign(topMat, FINISH[finish]);
      topMat.needsUpdate = true;
      edgeMat.color.set(paper);
      sticker = slab(w, h, STICKER_T, shape, topMat, edgeMat);
      group.add(sticker);
      layout();
      if (resized) frame();
    },
    start() {
      if (!raf) tick();
    },
    resetView() {
      camera.position.set(0, 0.85, 0.75);
      controls.autoRotate = !reducedMotion;
      frame();
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      stickerTex?.dispose();
      matTex.dispose();
      cardTex.dispose();
      renderer.dispose();
    },
  };
}
