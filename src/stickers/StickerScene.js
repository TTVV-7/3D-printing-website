// three.js stage for the sticker page: the sticker lying on a cutting mat
// with a 1 cm grid and a credit card beside it, so the size reads at a
// glance; or, with setBike(), wrapped round a tube of a bike (BikeScene.js)
// at its real size. Everything is in millimetres.
import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, NeutralToneMapping, SRGBColorSpace,
  DirectionalLight, Shape, ExtrudeGeometry, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  PlaneGeometry, CanvasTexture, Group, Raycaster, Vector2, Vector3, BufferGeometry, Float32BufferAttribute,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { outline as cutOutline } from "./thermal.js";
import { buildBike, bendAroundTube } from "./BikeScene.js";

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

// Splits a flat geometry's triangles until no edge is longer than `max` mm,
// so bending it round a tube gives a smooth curve, not facets.
function subdivide(geometry, max) {
  let g = geometry.index ? geometry.toNonIndexed() : geometry;
  for (let pass = 0; pass < 6; pass++) {
    const pos = g.attributes.position, uv = g.attributes.uv;
    const out = [], outUv = [], groups = [];
    let split = false;
    const P = (i) => new Vector3().fromBufferAttribute(pos, i);
    const U = (i) => new Vector2().fromBufferAttribute(uv, i);
    const tri = (a, b, c, ua, ub, uc) => {
      out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      outUv.push(ua.x, ua.y, ub.x, ub.y, uc.x, uc.y);
    };
    const groupOf = (i) => g.groups.find((gr) => i >= gr.start && i < gr.start + gr.count)?.materialIndex ?? 0;
    let start = 0, mi = groupOf(0);
    for (let i = 0; i < pos.count; i += 3) {
      const m = groupOf(i);
      if (m !== mi) {
        groups.push({ start, count: out.length / 3 - start, materialIndex: mi });
        start = out.length / 3;
        mi = m;
      }
      const v = [P(i), P(i + 1), P(i + 2)], u = [U(i), U(i + 1), U(i + 2)];
      const lens = [v[0].distanceTo(v[1]), v[1].distanceTo(v[2]), v[2].distanceTo(v[0])];
      const k = lens.indexOf(Math.max(...lens));
      if (lens[k] <= max) {
        tri(...v, ...u);
        continue;
      }
      split = true;
      const a = k, b = (k + 1) % 3, c = (k + 2) % 3;
      const mv = v[a].clone().lerp(v[b], 0.5), mu = u[a].clone().lerp(u[b], 0.5);
      tri(v[a], mv, v[c], u[a], mu, u[c]);
      tri(mv, v[b], v[c], mu, u[b], u[c]);
    }
    groups.push({ start, count: out.length / 3 - start, materialIndex: mi });
    const next = new BufferGeometry();
    next.setAttribute("position", new Float32BufferAttribute(out, 3));
    next.setAttribute("uv", new Float32BufferAttribute(outUv, 2));
    groups.forEach((gr) => next.addGroup(gr.start, gr.count, gr.materialIndex));
    g.dispose();
    g = next;
    if (!split) break;
  }
  return g;
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
    if (card.visible && ray.intersectObject(card).length) onCardClick();
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
  // On a bike: { type, place, built } or null for the mat and card.
  let bike = null;
  let last = null;

  function frame() {
    if (bike) return frameBike();
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

  // Close on the sticker, with enough frame round it to read the size; zoom
  // out to see the whole bike.
  function frameBike() {
    const { clientWidth: cw, clientHeight: ch } = canvas;
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const show = Math.max(size.w, size.h) * 4 + 260;
    const dist = Math.max(show / 2 / (tan * (cw / ch || 1)), show / 2 / tan);
    const at = group.position.clone();
    controls.target.copy(at);
    camera.position.copy(at).add(new Vector3(0.35, 0.18, 1).normalize().multiplyScalar(dist));
    controls.minDistance = Math.max(40, dist * 0.3);
    controls.maxDistance = 3500;
    controls.autoRotate = false;
    camera.near = 5;
    camera.far = 20000;
    camera.updateProjectionMatrix();
  }

  function layout() {
    if (bike) {
      const t = bike.built.tubes[bike.place] || bike.built.tubes.top;
      let ang = Math.atan2(t.to.y - t.from.y, t.to.x - t.from.x);
      // Keep text the right way up on tubes that lean back.
      if (ang > Math.PI / 2) ang -= Math.PI;
      if (ang < -Math.PI / 2) ang += Math.PI;
      group.position.copy(t.from).lerp(t.to, 0.5);
      group.rotation.set(0, 0, ang);
      return;
    }
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
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
      if (bike) {
        const t = bike.built.tubes[bike.place] || bike.built.tubes.top;
        const geo = new ExtrudeGeometry(stickerShape(w, h, crop, cropSeed), { depth: STICKER_T, bevelEnabled: false, curveSegments: 48 });
        // Enough rows across the sticker for it to curve smoothly.
        sticker = new Mesh(bendAroundTube(subdivide(geo, t.r / 6), t.r), [topMat, edgeMat]);
      } else {
        sticker = slab(w, h, STICKER_T, stickerShape(w, h, crop, cropSeed), topMat, edgeMat);
      }
      last = { art, w, h, crop, cropSeed, finish, paper };
      group.add(sticker);
      layout();
      if (resized) frame();
    },
    // Shows the sticker on a bike of `type` (BikeScene.js BIKES) on its
    // `place` tube ("top", "down", "seat"), or back on the mat with null.
    setBike(type, place = "top") {
      if (bike?.built && bike.type !== type) {
        scene.remove(bike.built.group);
        bike.built.group.traverse((o) => o.geometry?.dispose());
      }
      if (!type) {
        bike = null;
        mat.visible = card.visible = true;
        controls.target.set(0, 0, 0);
        camera.position.set(0, 0.85, 0.75);
      } else {
        const built = bike?.type === type ? bike.built : buildBike(type);
        if (bike?.type !== type) scene.add(built.group);
        bike = { type, place, built };
        mat.visible = card.visible = false;
      }
      if (last) this.update(last);
      else layout();
      frame();
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
      if (bike) return frameBike();
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
