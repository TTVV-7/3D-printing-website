// three.js stage for the instant estimate: shows the customer's own STL / 3MF,
// slowly turning, and lets them drag it around. Its own module so three.js is
// only fetched once someone drops a model into the quote form.
import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, ACESFilmicToneMapping,
  SRGBColorSpace, Box3, Group, DirectionalLight, Mesh, MeshStandardMaterial, Sphere, Vector3,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Looks down on the part a little so the top face catches the light.
const TILT = 0.35;

export function mountPreview(canvas, { reducedMotion }) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envMap;
  const key = new DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 4, 3);
  scene.add(key);

  // Flat shading: STL normals are often missing or wrong, and faceted reads
  // as "printed part" anyway. Hot-end orange to match the page.
  const material = new MeshStandardMaterial({ color: 0xff5b1f, roughness: 0.55, metalness: 0, flatShading: true });

  const camera = new PerspectiveCamera(30, 1, 1, 10000);
  const pivot = new Group();
  pivot.rotation.x = TILT;
  scene.add(pivot);

  let current = null;
  let radius = 50;

  function frameModel() {
    const { clientWidth: w, clientHeight: h } = canvas;
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const tanH = tanV * (w / h || 1);
    const dist = (radius / Math.min(tanV, tanH)) * 1.15;
    camera.position.set(0, 0, dist);
    camera.near = dist / 50;
    camera.far = dist * 4;
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

  // `geometries` come straight from measureFile; they're owned by the caller
  // and reused when the customer switches back, so they aren't disposed here.
  function show(geometries) {
    if (current) pivot.remove(current);
    current = new Group();
    for (const g of geometries) current.add(new Mesh(g, material));
    // Print files are Z-up; three.js is Y-up.
    current.rotation.x = -Math.PI / 2;
    current.updateMatrixWorld(true);
    const box = new Box3().setFromObject(current);
    const centre = box.getCenter(new Vector3());
    current.position.sub(centre);
    radius = box.getBoundingSphere(new Sphere()).radius || 50;
    pivot.add(current);
    pivot.rotation.set(TILT, -0.6, 0);
    spinBoost = 3;
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
    // Full tumble up and down so customers can check the underside.
    pivot.rotation.x = Math.max(-1.5, Math.min(1.5, pivot.rotation.x + dy * 0.01));
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
      material.dispose();
      envMap.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
