// GET /api/model-file?p=<path> (Cloudflare only): a model or its preview for
// the 3D models page, by its path in the Weave-Trial repo.
//
// Only files of models marked `show: true` in src/models/catalog.js are
// served. The first request for one fetches it from GitHub and keeps a copy
// in the R2 bucket bound as MODELS (weave-models); after that it comes from
// R2. To refresh a model that changed in the repo, delete its object from
// the bucket and the next view fetches it again.
import { models, MODELS_REPO } from "../src/models/catalog.js";

const SHOWN = new Set(models.filter((m) => m.show).flatMap((m) => [m.file, m.preview].filter(Boolean)));
const TYPES = { glb: "model/gltf-binary", "3mf": "model/3mf", stl: "model/stl", png: "image/png", jpg: "image/jpeg" };
const typeOf = (p) => TYPES[p.slice(p.lastIndexOf(".") + 1).toLowerCase()] || "application/octet-stream";
const headers = (p) => ({ "content-type": typeOf(p), "cache-control": "public, max-age=3600" });

export default async function modelFile(request, env, ctx) {
  if (request.method !== "GET") return new Response("GET only", { status: 405 });
  const p = new URL(request.url).searchParams.get("p") || "";
  if (!SHOWN.has(p)) return new Response("Not a model on this site", { status: 404 });

  const kept = env.MODELS && (await env.MODELS.get(p));
  if (kept) return new Response(kept.body, { headers: headers(p) });

  const res = await fetch(`https://raw.githubusercontent.com/${MODELS_REPO}/HEAD/${p.split("/").map(encodeURIComponent).join("/")}`);
  if (!res.ok || !res.body) return new Response("Model not found", { status: 404 });
  if (!env.MODELS) return new Response(res.body, { headers: headers(p) });
  // One copy to the browser, one into R2 for next time. R2 needs the whole
  // file (or its length) up front; shown models are a few MB at most.
  const [out, keep] = res.body.tee();
  const store = new Response(keep)
    .arrayBuffer()
    .then((buf) => env.MODELS.put(p, buf, { httpMetadata: { contentType: typeOf(p) } }));
  ctx?.waitUntil(store.catch((err) => console.error("model-file: keeping", p, err?.message || err)));
  return new Response(out, { headers: headers(p) });
}
