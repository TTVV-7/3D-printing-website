// three.js stage for the 3D models page: loads one GLB, 3MF or STL, fits it
// to the view and lets people turn and zoom it. Its own module so three.js
// only loads once someone opens a model.
import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, ACESFilmicToneMapping, SRGBColorSpace,
  Box3, DirectionalLight, Mesh, MeshStandardMaterial, Sphere, Vector3,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

// Plain STLs have no colour of their own: the site's orange plastic.
const PLASTIC = new MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.55, metalness: 0.05 });

async function load(url, ext) {
  if (ext === "glb") return (await new GLTFLoader().loadAsync(url)).scene;
  if (ext === "3mf") {
    const group = await new ThreeMFLoader().loadAsync(url);
    // 3MF is Z-up; the viewer is Y-up.
    group.rotation.x = -Math.PI / 2;
    return group;
  }
  const geometry = await new STLLoader().loadAsync(url);
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, PLASTIC);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

export async function mountModel(canvas, { url, ext, reducedMotion }) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new DirectionalLight(0xffffff, 1.4);
  key.position.set(2, 4, 3);
  scene.add(key);

  const camera = new PerspectiveCamera(35, 1, 0.1, 10000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 1.2;

  const object = await load(url, ext);
  scene.add(object);
  // Centre it and back the camera off until it fills the view.
  const box = new Box3().setFromObject(object);
  const centre = box.getCenter(new Vector3());
  object.position.sub(centre);
  const radius = box.getBoundingSphere(new Sphere()).radius || 1;
  const dist = radius / Math.sin((camera.fov * Math.PI) / 360) * 1.15;
  camera.position.set(dist * 0.6, dist * 0.45, dist * 0.75);
  camera.near = dist / 100;
  camera.far = dist * 10;
  controls.target.set(0, 0, 0);
  controls.minDistance = radius * 0.5;
  controls.maxDistance = dist * 4;

  const size = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(size);
  ro.observe(canvas);
  size();

  let raf = 0;
  const tick = () => {
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();
  // Stop turning on its own once someone grabs it.
  controls.addEventListener("start", () => (controls.autoRotate = false));

  // Its size in mm, for the card (models are in mm; Y-up after the turn).
  const dims = box.getSize(new Vector3());
  return {
    sizeMm: [dims.x, dims.z, dims.y].map((d) => Math.round(d)),
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      pmrem.dispose();
    },
  };
}
