// three.js scene for the floating crystal golem. Kept in its own module so the
// ~150 KB of three.js is only fetched after the page has finished loading.
import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, ACESFilmicToneMapping,
  SRGBColorSpace, Box3, Vector3, Group,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MODEL_URL = "/models/crystal-golem.glb";

// Mounts the golem into `canvas`. Returns controls for the component and a
// dispose() that frees the GPU resources.
export async function mountGolem(canvas, { reducedMotion }) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envMap;

  const camera = new PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0.12, 2.25);
  camera.lookAt(0, 0, 0);

  const draco = new DRACOLoader().setDecoderPath("/draco/");
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(MODEL_URL);
  draco.dispose();

  // Centre the model on its bounding box so it spins in place.
  const model = gltf.scene;
  const box = new Box3().setFromObject(model);
  model.position.sub(box.getCenter(new Vector3()));
  const pivot = new Group();
  pivot.add(model);
  scene.add(pivot);

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  // Motion: slow spin + bob, with a speed boost that decays after a hover or tap.
  let spin = 0.6;          // rad/s
  let boost = 0;
  let hop = 0;             // 0..1 progress of a click hop
  let tiltX = 0, tiltY = 0; // follows the pointer a little
  let last = performance.now();
  let raf = 0;
  let running = false;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    boost *= Math.exp(-dt * 2);
    pivot.rotation.y += (spin + boost) * dt;
    pivot.rotation.x += (tiltX - pivot.rotation.x) * dt * 3;
    pivot.rotation.z += (tiltY - pivot.rotation.z) * dt * 3;
    let y = Math.sin(now / 900) * 0.04;
    if (hop > 0) {
      hop = Math.min(hop + dt * 2.2, 1);
      y += Math.sin(hop * Math.PI) * 0.18;
      if (hop >= 1) hop = 0;
    }
    pivot.position.y = y;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reducedMotion) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  // A still, three-quarter pose for people who prefer less motion.
  pivot.rotation.y = -0.5;
  renderer.render(scene, camera);
  start();

  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", resize);

  return {
    excite() { boost = 6; },
    hop() { if (!reducedMotion && hop === 0) { hop = 0.001; boost = 8; } },
    lean(nx, ny) { tiltX = ny * 0.25; tiltY = -nx * 0.15; },
    dispose() {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        for (const m of [].concat(o.material)) {
          for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
          m.dispose();
        }
      });
      envMap.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
