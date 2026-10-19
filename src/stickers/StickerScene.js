// three.js stage for the sticker page: the sticker lying on a cutting mat
// with a 1 cm grid and a credit card beside it, so the size reads at a
// glance. Everything is in millimetres.
import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, NeutralToneMapping, SRGBColorSpace,
  DirectionalLight, Shape, ExtrudeGeometry, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  PlaneGeometry, CanvasTexture, Group, Raycaster, Vector2,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { outline as cutOutline } from "./thermal.js";

const CARD = { w: 85.6, h: 53.98, t: 0.76 };
const STICKER_T = 0.35; // a label and its backing, a touch thick so the edge shows
const GAP = 14;

const FINISH = {
  matte: { roughness: 0.9, metalness: 0, clearcoat: 0 },
  chrome: { roughness: 0.12, metalness: 1, clearcoat: 0.6, clearcoatRoughness: 0.05, envMapIntensity: 1.6 },
};

// For chrome: the label is metal, the ink isn't. White where it shines.
function metalMap(art) {
  const c = document.createElement("canvas");
  c.width = art.width;
  c.height = art.height;
  const g = c.getContext("2d");
  g.drawImage(art, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = d.data[i] + d.data[i + 1] + d.data[i + 2] < 200 ? 0 : 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}

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

// The sticker's cut outline as a three.js Shape, centred, y up. The 2D
// outline draws y down from the top-left corner, so this flips it.
function stickerShape(w, h, crop, cropSeed) {
  const s = new Shape();
  const X = (x) => x - w / 2, Y = (y) => h / 2 - y;
  cutOutline({
    moveTo: (x, y) => s.moveTo(X(x), Y(y)),
    lineTo: (x, y) => s.lineTo(X(x), Y(y)),
    arc: (x, y, r, a0, a1) => s.absarc(X(x), Y(y), r, -a0, -a1, true),
    closePath: () => s.closePath(),
  }, { w, h, crop, cropSeed }, 1);
  return s;
}

// A flat slab of `shape` (a Shape, or a key for outline()), lying on the
// table, its top at `t`.
function slab(w, h, t, shape, topMaterial, edgeMaterial) {
  const s = typeof shape === "string" ? outline(w, h, shape) : shape;
  const geo = new ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 48 });
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

// The card is a pale, see-through stand-in with "for scale" written on it,
// so nobody mistakes it for the thing they're buying.
function cardTexture() {
  const px = 8;
  const c = document.createElement("canvas");
  c.width = Math.round(CARD.w * px);
  c.height = Math.round(CARD.h * px);
  const g = c.getContext("2d");
  g.fillStyle = "#dfe6ee";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#5b6b80";
  g.lineWidth = 0.8 * px;
  g.setLineDash([3 * px, 2 * px]);
  g.beginPath();
  g.roundRect(2.5 * px, 2.5 * px, c.width - 5 * px, c.height - 5 * px, 2 * px);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = "#c9ccd2";
  g.beginPath();
  g.roundRect(9 * px, 9 * px, 11 * px, 8.5 * px, 1.4 * px);
  g.fill();
  g.fillStyle = "#3d4b5e";
  g.textAlign = "center";
  g.font = `700 ${8.5 * px}px ui-sans-serif, system-ui, sans-serif`;
  g.fillText("FOR SCALE", c.width / 2, 33 * px);
  g.font = `500 ${4 * px}px ui-sans-serif, system-ui, sans-serif`;
  g.fillText("Credit card · 85.6 × 54 mm", c.width / 2, 42 * px);
  return c;
}

// The same card as a real one, for anyone who wants to picture it in hand.
function realCardTexture() {
  const px = 8;
  const c = document.createElement("canvas");
  c.width = Math.round(CARD.w * px);
  c.height = Math.round(CARD.h * px);
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, "#2c5282");
  grad.addColorStop(1, "#0c1a2e");
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#d9b45a";
  g.beginPath();
  g.roundRect(9 * px, 16 * px, 11 * px, 8.5 * px, 1.4 * px);
  g.fill();
  // Print Yours' card: pi for a number, expiring on Pi Day.
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.font = `700 ${4.4 * px}px "Space Grotesk", ui-sans-serif, system-ui, sans-serif`;
  g.textAlign = "right";
  g.fillText("printyours", c.width - 7 * px, 11 * px);
  g.fillStyle = "#ff5b1f";
  g.font = `700 ${6 * px}px ui-serif, Georgia, serif`;
  g.fillText("π", c.width - 7 * px, 48 * px);
  g.textAlign = "left";
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.font = `600 ${4.6 * px}px ui-monospace, monospace`;
  g.fillText("3141  5926  5358  9793", 9 * px, 36 * px);
  g.font = `600 ${3.2 * px}px ui-sans-serif, system-ui, sans-serif`;
  g.fillStyle = "rgba(255,255,255,0.7)";
  g.fillText("PRINT YOURS", 9 * px, 46 * px);
  g.fillText("03/14", 52 * px, 46 * px);
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

  const cardTextures = [cardTexture(), realCardTexture()].map((c) => {
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    fitTexture(t, CARD.w, CARD.h);
    return t;
  });
  const cardFace = new MeshPhysicalMaterial({ map: cardTextures[0] });
  const cardEdge = new MeshStandardMaterial({ roughness: 0.7 });
  const card = slab(CARD.w, CARD.h, CARD.t, "card", cardFace, cardEdge);
  scene.add(card);

  // Pale and see-through "for scale", or a real-looking card.
  function cardLook(real) {
    cardFace.map = cardTextures[real ? 1 : 0];
    Object.assign(cardFace, real
      ? { roughness: 0.35, clearcoat: 0.8, transparent: false, opacity: 1 }
      : { roughness: 0.7, clearcoat: 0, transparent: true, opacity: 0.8 });
    cardEdge.color.set(real ? 0x0c1a2e : 0xaab4c2);
    Object.assign(cardEdge, { transparent: !real, opacity: real ? 1 : 0.8 });
    cardFace.needsUpdate = cardEdge.needsUpdate = true;
  }
  cardLook(false);

  // A click (not a drag) on the card or the sticker, for the page to act on.
  let onCardClick = () => {};
  let onStickerClick = () => {};
  const ray = new Raycaster();
  let down = null;
  const onDown = (e) => (down = { x: e.clientX, y: e.clientY });
  const onUp = (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    if (ray.intersectObject(card).length) onCardClick();
    else if (ray.intersectObject(group).length) onStickerClick();
  };
  const onMove = (e) => {
    if (e.buttons) return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    canvas.style.cursor = ray.intersectObjects([card, group]).length ? "pointer" : "";
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointermove", onMove);

  const group = new Group();
  scene.add(group);
  let sticker = null, stickerTex = null, metalTex = null;
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
    // `art` is the canvas from previewArt() (thermal.js).
    update({ art, w, h, crop, cropSeed, finish, paper }) {
      const resized = w !== size.w || h !== size.h;
      size = { w, h };
      if (sticker) {
        group.remove(sticker);
        sticker.geometry.dispose();
      }
      stickerTex?.dispose();
      stickerTex = new CanvasTexture(art);
      stickerTex.colorSpace = SRGBColorSpace;
      stickerTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      fitTexture(stickerTex, w, h);
      topMat.map = stickerTex;
      metalTex?.dispose();
      metalTex = finish === "chrome" ? new CanvasTexture(metalMap(art)) : null;
      if (metalTex) fitTexture(metalTex, w, h);
      topMat.metalnessMap = metalTex;
      Object.assign(topMat, FINISH[finish]);
      topMat.needsUpdate = true;
      edgeMat.color.set(paper);
      sticker = slab(w, h, STICKER_T, stickerShape(w, h, crop, cropSeed), topMat, edgeMat);
      group.add(sticker);
      layout();
      if (resized) frame();
    },
    cardLook,
    onCardClick(fn) {
      onCardClick = fn;
    },
    onStickerClick(fn) {
      onStickerClick = fn;
    },
    start() {
      if (!raf) tick();
    },
    // Pauses rendering while the page shows the full-colour maker instead.
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
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
      metalTex?.dispose();
      matTex.dispose();
      cardTextures.forEach((t) => t.dispose());
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointermove", onMove);
      renderer.dispose();
    },
  };
}
