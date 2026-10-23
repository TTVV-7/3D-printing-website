// Cloudflare Turnstile check for the routes bots could abuse: quote requests
// and their uploads and emails, and friends-and-family sticker requests
// (GUARDED in worker.js), plus AI sticker art (sticker-ai.js). Off until the
// Worker has the TURNSTILE_SECRET secret; the browser side is
// src/lib/turnstile.js.
//
// One quote sends several requests (each file, the request, its emails) with
// the same token, but Cloudflare accepts a token only once. So the first
// check asks Cloudflare and remembers a pass in KV for ten minutes, good for
// up to USES requests.
const USES = 30;
const TTL = 10 * 60;

async function hash(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...bytes.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function passesTurnstile(env, token, request) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token || token.length > 2048) return false;

  const key = env.AI_LIMITS && `ts:${await hash(token)}`;
  if (key) {
    const used = Number((await env.AI_LIMITS.get(key)) || 0);
    if (used > 0) {
      if (used >= USES) return false;
      await env.AI_LIMITS.put(key, String(used + 1), { expirationTtl: TTL });
      return true;
    }
  }

  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET);
  body.append("response", token);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const ok = Boolean((await res.json().catch(() => ({}))).success);
  if (ok && key) await env.AI_LIMITS.put(key, "1", { expirationTtl: TTL });
  return ok;
}
