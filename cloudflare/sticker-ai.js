// POST /api/sticker-ai (Cloudflare only): AI sticker art for /stickers.
//
//   { mode: "create", prompt, style, maker }        text -> sticker art
//   { mode: "stickerize", image, style, maker }     a photo -> sticker art
//
// `image` is a data URL the page has already shrunk under 512 px (the model's
// limit for input images). Answers { image: <data URL>, left: <tries left
// today> }. The page drops the result into the normal upload flow, so the
// customer still crops, shapes and orders it as usual.
//
// Runs FLUX.2 [klein] 4B on Workers AI (binding AI). Limits, so a bot or a
// keen visitor can't burn the free daily allowance:
//   - AI_PER_VISITOR generations per visitor (by IP) per UTC day, default 5
//   - AI_PER_DAY across the whole site per UTC day, default 60
//   - a Turnstile check when TURNSTILE_SECRET is set
// Counts live in the KV namespace bound as AI_LIMITS.
//
// Prompts naming well-known characters, brands or adult content are turned
// away up front. That's a first filter, not a guarantee: every order is still
// looked at before it's printed.
import { passesTurnstile } from "./turnstile.js";

const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const MAX_PROMPT = 200;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

const STYLES = {
  cartoon: "bright flat cartoon illustration with bold outlines and simple shading",
  cute: "cute kawaii style with soft pastel colours, big shapes and a thick outline",
  retro: "retro 70s badge style with warm muted colours and halftone texture",
  watercolour: "loose watercolour illustration with soft edges and visible paper texture",
  lineart: "bold black ink line art with thick clean outlines, no shading and no grey",
};
// The thermal printer only does black on white, so it always gets line art.
const THERMAL_STYLE =
  "bold black ink line art, thick clean outlines, solid black fills, pure white everywhere else, no grey, no shading, no gradients";

const FRAME =
  "Designed as a die-cut sticker: one centred subject, nothing touching the edges, on a plain flat white background. No text, letters or watermark.";

// Characters, brands and franchises customers will try for, plus adult terms.
// Matched as whole words, case-insensitive. Extend as new ones turn up.
const BLOCKED = [
  "disney", "pixar", "marvel", "dc comics", "mickey", "minnie", "goofy", "elsa", "frozen", "stitch",
  "pokemon", "pokémon", "pikachu", "nintendo", "mario", "luigi", "zelda", "kirby", "sonic", "sega",
  "hello kitty", "sanrio", "kuromi", "my melody", "spongebob", "simpsons", "peppa", "bluey", "paw patrol",
  "batman", "superman", "spiderman", "spider-man", "wonder woman", "avengers", "iron man", "hulk", "deadpool",
  "star wars", "darth vader", "yoda", "baby yoda", "grogu", "mandalorian", "harry potter", "hogwarts",
  "shrek", "minion", "minions", "garfield", "snoopy", "peanuts", "looney tunes", "bugs bunny", "scooby",
  "naruto", "one piece", "dragon ball", "goku", "studio ghibli", "totoro", "sailor moon", "demon slayer",
  "nike", "adidas", "supreme", "gucci", "louis vuitton", "chanel", "rolex", "ferrari", "lamborghini",
  "apple logo", "coca-cola", "coca cola", "pepsi", "starbucks", "mcdonalds", "mcdonald's", "red bull", "monster energy",
  "nfl", "nba", "nhl", "mlb", "fifa", "canucks", "lakers", "yankees",
  // Bike and outdoor brands: riders ask for replacement frame decals. Words
  // that are also everyday ones ("giant", "cube", "orbea"...) stay off the
  // list, or "a giant cat" would be refused.
  "rocky mountain bicycles", "rocky mountain bikes", "norco", "santa cruz bicycles", "santa cruz bikes", "trek bikes", "trek bicycles",
  "specialized bikes", "specialized bicycles", "s-works", "cannondale", "yeti cycles", "pivot cycles", "transition bikes", "commencal", "canyon bikes", "kona bikes",
  "devinci", "evil bikes", "ibis cycles", "intense cycles", "marin bikes", "scott bikes", "we are one composites", "forbidden bike",
  "shimano", "sram", "fox racing", "fox shox", "rockshox", "maxxis", "chris king", "industry nine", "oneup components",
  "arc'teryx", "arcteryx", "lululemon", "patagonia", "the north face", "red bull rampage", "crankworx",
  "nude", "naked", "nsfw", "sexy", "porn", "hentai", "boobs", "genitals", "swastika", "nazi",
];
const blockedRe = new RegExp(`(^|[^a-z0-9])(${BLOCKED.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})([^a-z0-9]|$)`, "i");

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });

const today = () => new Date().toISOString().slice(0, 10);

async function visitorKey(request) {
  // Hashed so raw IP addresses never sit in KV.
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`printyours-ai:${ip}`));
  return [...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function bump(kv, key, by) {
  const n = Math.max(0, Number((await kv.get(key)) || 0) + by);
  // Two days so a count never vanishes before its UTC day is over.
  await kv.put(key, String(n), { expirationTtl: 2 * 24 * 60 * 60 });
  return n;
}

function dataUrlToBlob(dataUrl) {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!m) return null;
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  if (bytes.length > MAX_IMAGE_BYTES) return null;
  return new Blob([bytes], { type: m[1] });
}

function buildPrompt({ mode, prompt, style, maker }) {
  const look = maker === "thermal" ? THERMAL_STYLE : STYLES[style] || STYLES.cartoon;
  if (mode === "stickerize") {
    return `Redraw the main subject of image 0 as a sticker in this style: ${look}. Keep its likeness, pose and key details, drop the original background. ${FRAME}`;
  }
  return `A sticker of ${prompt}. Style: ${look}. ${FRAME}`;
}

const mimeOf = (b64) => (b64.startsWith("/9j/") ? "image/jpeg" : b64.startsWith("UklGR") ? "image/webp" : "image/png");

export default async function stickerAi(request, env) {
  if (request.method !== "POST") return json({ error: "POST only" }, 405);
  if (!env.AI || !env.AI_LIMITS) return json({ error: "AI stickers aren't switched on here" }, 503);

  const body = await request.json().catch(() => ({}));
  const mode = body.mode === "stickerize" ? "stickerize" : "create";
  const maker = body.maker === "colour" ? "colour" : "thermal";
  const style = Object.hasOwn(STYLES, body.style) ? body.style : "cartoon";
  const prompt = String(body.prompt || "").replace(/\s+/g, " ").trim().slice(0, MAX_PROMPT);

  let photo = null;
  if (mode === "create") {
    if (prompt.length < 3) return json({ error: "Describe your sticker in a few words" }, 400);
    if (blockedRe.test(prompt)) {
      return json({ error: "We can't make stickers of trademarked characters, brands or adult content. Try describing something original!" }, 422);
    }
  } else {
    photo = dataUrlToBlob(body.image);
    if (!photo) return json({ error: "That photo couldn't be read. Try a JPG or PNG." }, 400);
  }

  if (!(await passesTurnstile(env, body.turnstile, request))) {
    return json({ error: "Couldn't confirm you're not a bot. Refresh the page and try again." }, 403);
  }

  // Count the attempt before running it so parallel requests can't slip past;
  // a failed generation gives it back.
  const perVisitor = Number(env.AI_PER_VISITOR || 5);
  const perDay = Number(env.AI_PER_DAY || 60);
  const day = today();
  const mine = `ai:${day}:${await visitorKey(request)}`;
  const all = `ai:${day}:all`;
  const [usedMine, usedAll] = await Promise.all([env.AI_LIMITS.get(mine), env.AI_LIMITS.get(all)]);
  if (Number(usedMine || 0) >= perVisitor) {
    return json({ error: `That's your ${perVisitor} free AI designs for today. Upload your own image, or come back tomorrow!`, left: 0 }, 429);
  }
  if (Number(usedAll || 0) >= perDay) {
    return json({ error: "The AI sticker maker is resting for today. Upload your own image, or try again tomorrow!" }, 429);
  }
  const [nowMine] = await Promise.all([bump(env.AI_LIMITS, mine, 1), bump(env.AI_LIMITS, all, 1)]);

  const form = new FormData();
  form.append("prompt", buildPrompt({ mode, prompt, style, maker }));
  form.append("width", "1024");
  form.append("height", "1024");
  if (photo) form.append("input_image_0", photo, "photo");
  const packed = new Response(form);

  try {
    const out = await env.AI.run(MODEL, {
      multipart: { body: packed.body, contentType: packed.headers.get("content-type") },
    });
    if (!out?.image) throw new Error("no image in response");
    return json({ image: `data:${mimeOf(out.image)};base64,${out.image}`, left: Math.max(0, perVisitor - nowMine) });
  } catch (err) {
    console.error("sticker-ai:", err?.message || err);
    await Promise.all([bump(env.AI_LIMITS, mine, -1), bump(env.AI_LIMITS, all, -1)]);
    return json({ error: "The AI couldn't draw that one. Try again, or describe it differently." }, 502);
  }
}
