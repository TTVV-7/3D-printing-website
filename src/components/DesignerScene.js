// three.js stage for the "Design your own" section: shows one generator sample
// at a time, slowly turning, and lets you drag it around. Its own module so
// three.js is only fetched once the section is near the screen.
import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, ACESFilmicToneMapping,
  SRGBColorSpace, Box3, Group, DirectionalLight, Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Each sample leans back a little so the face catches the light.
const TILT = -0.18;

export async function mountDesigner(canvas, { reducedMotion }) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envMap;
  const key = new DirectionalLight(0xffffff, 1.4);
  key.position.set(2, 3, 4);
  scene.add(key);

  const camera = new PerspectiveCamera(30, 1, 1, 2000);
  const pivot = new Group();
  pivot.rotation.x = TILT;
  scene.add(pivot);

  const loader = new GLTFLoader();
  const cache = new Map();
  let current = null;
  // Half-extents to fit: across (any angle of the turn) and up.
  let across = 30, up = 20;
  let wanted = null;

  function frameModel() {
    const { clientWidth: w, clientHeight: h } = canvas;
    // Fit the model as it turns: its widest sweep across, its height up.
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const tanH = tanV * (w / h || 1);
    const dist = Math.max(across / tanH, up / tanV) * 1.25 + across;
    camera.position.set(0, 0, dist);
    camera.near = camera.position.z / 20;
    camera.far = camera.position.z * 4;
    camera.updateProjectionMatrix();
  }

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    frameModel();
    if (!running) renderer.render(scene, camera);
  }

  async function show(url) {
    wanted = url;
    let model = cache.get(url);
    if (!model) {
      const gltf = await loader.loadAsync(url);
      model = gltf.scene;
      model.traverse((o) => {
        if (o.isMesh) o.material.flatShading = true; // no normals in the file
      });
      cache.set(url, model);
    }
    if (wanted !== url) return; // a newer choice arrived while this loaded
    if (current) pivot.remove(current);
    current = model;
    pivot.add(model);
    const size = new Box3().setFromObject(model).getSize(new Vector3()).multiplyScalar(0.5);
    across = Math.hypot(size.x, size.z);
    up = size.y + size.z;
    pivot.rotation.set(TILT, -0.6, 0);
    spinBoost = 4;
    frameModel();
    renderer.render(scene, camera);
  }

  // Motion: a slow turn, a flick of speed on change, and drag to rotate.
  let spinBoost = 0;
  let dragging = null;
  let velocity = 0;
  let last = performance.now();
  let raf = 0;
  let running = false;
  let visible = true;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    spinBoost *= Math.exp(-dt * 3);
    if (!dragging) {
      velocity *= Math.exp(-dt * 2.5);
      pivot.rotation.y += (0.45 + spinBoost + velocity) * dt;
      pivot.rotation.x += (TILT - pivot.rotation.x) * dt * 2;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running || reducedMotion || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const onDown = (e) => {
    dragging = { x: e.clientX, y: e.clientY, t: performance.now() };
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.x;
    const dy = e.clientY - dragging.y;
    const dt = Math.max((performance.now() - dragging.t) / 1000, 0.001);
    pivot.rotation.y += dx * 0.01;
    pivot.rotation.x = Math.max(-1.2, Math.min(0.6, pivot.rotation.x + dy * 0.008));
    velocity = (dx * 0.01) / dt;
    dragging = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (!running) renderer.render(scene, camera);
  };
  const onUp = () => {
    dragging = null;
    velocity = Math.max(-8, Math.min(8, velocity));
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  // Only animate while the stage is on screen.
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  });
  io.observe(canvas);
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  start();

  return {
    show,
    dispose() {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      for (const model of cache.values())
        model.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.dispose();
          o.material.dispose();
        });
      envMap.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
