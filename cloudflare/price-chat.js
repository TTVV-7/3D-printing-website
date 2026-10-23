// POST /api/price-chat (Cloudflare only): the "Ask about a price" chat.
//
//   { messages: [{ role: "user" | "assistant", content }] }
//   -> { reply, estimate?, left }
//
// A Workers AI model talks to the customer, knowing the services, materials,
// sticker prices and delivery from site.config.js (so it follows price
// changes there). It never does price maths itself: once it knows roughly
// what a part is, it writes an <estimate> block with the part's size and
// build, and this works out the price with the quote form's own formula
// (src/lib/meshEstimate.js), so a chat estimate matches an uploaded file's.
//
// Limits, counted in the AI_LIMITS KV namespace like the sticker maker's:
// CHAT_PER_VISITOR messages per visitor (by IP) per UTC day, default 30, and
// CHAT_PER_DAY across the site, default 400. No Turnstile check: the chat
// sends no email and stores nothing, and those limits cap what a bot can use.
import { site, pricing, estimate as cfg, stickers } from "../site.config.js";
import { partEstimate } from "../src/lib/estimateMath.js";
import { priceEach, priceColourEach, deliveryCost } from "../src/stickers/pricing.js";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_TURNS = 16;
const MAX_CHARS = 600;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });

const money = (n) => `$${n.toFixed(2)}`;

// What the assistant knows, written out from site.config.js.
function facts() {
  const services = pricing.services
    .map((s) => `- ${s.title}: ${s.price} ${s.unit}. ${s.body} (${s.includes.join("; ")})`)
    .join("\n");
  const materials = Object.entries(cfg.materials)
    .map(([name, m]) => `${name} ($${m.perGram.toFixed(2)}/g)`)
    .join(", ");
  const thermal = [
    ["round-2in", 10], ["round-2in", 25], ["round-2in", 100], ["sq-3in", 10], ["50x30", 25], ["4x2in", 10],
  ].map(([key, qty]) => {
    const s = stickers.sizes.find((x) => x.key === key);
    const each = priceEach(s, "matte", qty);
    return `${qty} × ${s.name}: ${money(each)} each (${money(each * qty)})`;
  });
  const colour = [[50.8, 50.8, 10], [76.2, 76.2, 10], [76.2, 76.2, 50]].map(
    ([w, h, qty]) => `${qty} × ${Math.round(w / 25.4)}" × ${Math.round(h / 25.4)}": ${money(priceColourEach({ w, h }, qty))} each`,
  );
  const delivery = stickers.delivery
    .map((d) => `${d.name}: ${deliveryCost(d, 0) ? money(d.amount) : "free"}${d.freeOver ? `, free over $${d.freeOver}` : ""}`)
    .join("; ");
  return `Business: ${site.name}, ${site.tagline}. One person (Thomas) runs it in ${site.city}, ${site.region}.
Services:
${services}
Extras: ${pricing.extras.join("; ")}.
Materials: ${materials}. PLA is the general-purpose choice with the best detail; PETG is tougher, handles heat and sun better and is water resistant (good outdoors); Nylon is very tough and wear resistant; TPU is flexible and rubbery.
3D print pricing: filament by weight plus $${cfg.machinePerHour}/hour of print time, $${cfg.setupPerPart} setup per different part, $${cfg.orderMinimum} order minimum. ${cfg.bulk.map((b) => `${b.min}+ copies: ${b.off * 100}% off`).join(", ")}. Largest part: ${cfg.maxSizeMm} mm on a side.
Stickers (made at printyours.ca/stickers, where people design them and see the exact price):
- Thermal labels, black ink on white or coloured die-cut labels, sizes from 40 × 30 mm to 3" × 4.4". Examples: ${thermal.join("; ")}. Discounts at 25+ and 100+.
- Full colour vinyl, cut to any shape: ${stickers.colour.available ? "available" : "coming soon, not on sale yet"}. Examples: ${colour.join("; ")}.
- Bike stickers (frame name, trail sticker, emergency ID) are on the stickers page's Bike tab; clubs and teams order at printyours.ca/bike.
Sticker delivery: ${delivery}. Usually printed in ${stickers.shipping.printDays.join("–")} business days.
Quotes: free, a reply within one business day, a fixed price before anything prints. Contact: ${site.email}.`;
}

const SYSTEM = () => `You are the price helper on the ${site.name} website. Answer questions about prices, materials, stickers, turnaround and delivery using only the facts below. Be brief and friendly: two to four short sentences, plain text, no markdown headings.

${facts()}

Rules:
- Never invent prices, discounts, services or promises that aren't in the facts. If you don't know, say Thomas will confirm in the free quote.
- For a 3D print estimate you need: roughly how big it is (length × width × height in mm, or a comparison you can turn into mm), how solid it is (solid and chunky, a normal part, or thin-walled/hollow), and how many. Ask for what's missing, one short question at a time; suggest a material if they're unsure.
- When you know enough, end your reply with exactly one line:
<estimate>{"name": "short description", "lengthMm": 80, "widthMm": 30, "heightMm": 20, "build": "normal", "material": "PLA", "quantity": 4}</estimate>
  build is "solid", "normal" or "thin". material is one of ${Object.keys(cfg.materials).join(", ")}. Do not write a price yourself; the website adds it.
- For stickers, give the example prices and point them to printyours.ca/stickers for the exact price.
- If someone needs a part designed (no file), mention the custom design service.
- Stay on topic: printing, stickers and this business. Politely decline anything else.`;

// How much of a part's bounding box is plastic, by how it's built.
const FILL = { solid: 0.55, normal: 0.3, thin: 0.12 };

// A price range for a described part, from the quote form's formula.
function priceFor(e) {
  const dims = ["lengthMm", "widthMm", "heightMm"].map((k) => Math.min(cfg.maxSizeMm * 2, Math.max(1, Number(e[k]) || 0)));
  if (dims.some((d) => !(d > 0))) return null;
  const [a, b, c] = dims;
  const fill = FILL[e.build] ?? FILL.normal;
  const material = cfg.materials[e.material] ? e.material : cfg.defaultMaterial;
  const quantity = Math.max(1, Math.min(1000, Math.round(Number(e.quantity) || 1)));
  const measure = { volume: a * b * c * fill, area: 2 * (a * b + b * c + c * a), size: dims };
  const p = partEstimate(measure, { material, quantity, quality: "" }, cfg);
  return {
    name: String(e.name || "Your part").slice(0, 80),
    sizeMm: dims.map((d) => Math.round(d)),
    build: e.build in FILL ? e.build : "normal",
    material,
    quantity,
    low: Math.max(cfg.orderMinimum, p.low),
    high: Math.max(cfg.orderMinimum, p.high),
    tooBig: dims.some((d) => d > cfg.maxSizeMm),
  };
}

const today = () => new Date().toISOString().slice(0, 10);
async function visitorKey(request) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`printyours-chat:${ip}`));
  return [...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function bump(kv, key) {
  const n = Number((await kv.get(key)) || 0) + 1;
  await kv.put(key, String(n), { expirationTtl: 2 * 24 * 60 * 60 });
  return n;
}
export default async function priceChat(request, env) {
  if (request.method !== "POST") return json({ error: "POST only" }, 405);
  if (!env.AI || !env.AI_LIMITS) return json({ error: "The price helper isn't switched on here" }, 503);

  const body = await request.json().catch(() => ({}));
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "Ask a question" }, 400);

  const perVisitor = Number(env.CHAT_PER_VISITOR || 30);
  const perDay = Number(env.CHAT_PER_DAY || 400);
  const day = today();
  const mine = `chat:${day}:${await visitorKey(request)}`;
  const all = `chat:${day}:all`;
  const [usedMine, usedAll] = await Promise.all([env.AI_LIMITS.get(mine), env.AI_LIMITS.get(all)]);
  if (Number(usedMine || 0) >= perVisitor || Number(usedAll || 0) >= perDay) {
    return json({ error: `The price helper is resting for today. Ask in a free quote instead, or email ${site.email}.`, left: 0 }, 429);
  }
  const [nowMine] = await Promise.all([bump(env.AI_LIMITS, mine), bump(env.AI_LIMITS, all)]);

  let text;
  try {
    const out = await env.AI.run(MODEL, { messages: [{ role: "system", content: SYSTEM() }, ...messages], max_tokens: 400, temperature: 0.3 });
    text = String(out?.response || "").trim();
    if (!text) throw new Error("empty reply");
  } catch (err) {
    console.error("price-chat:", err?.message || err);
    return json({ error: "The price helper couldn't answer just now. Try again in a moment." }, 502);
  }

  // Swap the model's estimate block for a price worked out here.
  let estimate = null;
  const m = text.match(/<estimate>\s*([\s\S]*?)\s*<\/estimate>/i);
  if (m) {
    try {
      estimate = priceFor(JSON.parse(m[1]));
    } catch {
      estimate = null;
    }
    text = text.replace(m[0], "").trim();
  }
  return json({ reply: text, estimate, left: Math.max(0, perVisitor - nowMine) });
}

// For tests: the price maths on its own.
export { priceFor };
