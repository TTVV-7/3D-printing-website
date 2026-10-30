// Custom analytics events, kept in the D1 database bound as DB (printyours;
// table in cloudflare/schema.sql). Cloudflare Web Analytics counts page views
// and referrers; this counts what people do: quotes sent, sticker checkouts,
// price chats, models opened, videos played. Nothing personal is stored.
//
//   POST /api/event   {name, page, source, detail}  from track() in the
//                     browser (cloudflare/client/analytics.js)
//   GET  /api/stats?key=<STATS_KEY>  a page of totals for the last 30 days,
//                     by event and by where visitors came from
//
// STATS_KEY is a Worker secret; without it the stats page stays closed.

// Only these names are kept, so nobody can fill the table with junk.
export const EVENTS = [
  "Quote submitted",
  "Sticker checkout",
  "Sticker request",
  "AI sticker",
  "Price chat",
  "Price estimate to quote",
  "Model opened",
  "Get this printed",
  "Video played",
  "Subscribe clicked",
];
const clip = (v, n) => (typeof v === "string" ? v.slice(0, n) : null);

export async function event(request, env) {
  if (request.method !== "POST") return new Response("POST only", { status: 405 });
  if (!env.DB) return new Response(null, { status: 204 });
  const body = await request.json().catch(() => null);
  if (!body || !EVENTS.includes(body.name)) return new Response("Unknown event", { status: 400 });
  const detail = body.detail && typeof body.detail === "object" ? JSON.stringify(body.detail).slice(0, 500) : null;
  await env.DB.prepare("INSERT INTO events (name, page, source, detail) VALUES (?, ?, ?, ?)")
    .bind(body.name, clip(body.page, 120), clip(body.source, 60) || "unknown", detail)
    .run();
  return new Response(null, { status: 204 });
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function table(title, head, rows) {
  if (!rows.length) return `<h2>${esc(title)}</h2><p class="none">Nothing yet.</p>`;
  return `<h2>${esc(title)}</h2><table><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</table>`;
}

export async function stats(request, env) {
  const key = new URL(request.url).searchParams.get("key");
  if (!env.STATS_KEY || key !== env.STATS_KEY) return new Response("Not found", { status: 404 });
  if (!env.DB) return new Response("No database bound (DB)", { status: 500 });

  const since = "datetime('now', '-30 days')";
  const [byName, bySource, quotesBySource, recent] = await Promise.all([
    env.DB.prepare(`SELECT name, COUNT(*) n FROM events WHERE at > ${since} GROUP BY name ORDER BY n DESC`).all(),
    env.DB.prepare(`SELECT source, COUNT(*) n FROM events WHERE at > ${since} GROUP BY source ORDER BY n DESC LIMIT 15`).all(),
    env.DB.prepare(
      `SELECT source, name, COUNT(*) n FROM events WHERE at > ${since} AND name IN ('Quote submitted', 'Sticker checkout', 'Sticker request', 'Price estimate to quote') GROUP BY source, name ORDER BY n DESC`,
    ).all(),
    env.DB.prepare("SELECT at, name, source, page, detail FROM events ORDER BY id DESC LIMIT 40").all(),
  ]);

  // Whether payments on printyours.ca will work: the live Stripe key's kind,
  // never the key itself.
  const liveKey = env.STRIPE_SECRET_KEY || env.STRIPE_PRODUCTION || env.Stripe_Claude || "";
  const stripeNote = /^(sk|rk)_live_/.test(liveKey)
    ? "Stripe: a live key is set, so sticker checkout takes real payments on printyours.ca."
    : /^(sk|rk)_test_/.test(liveKey)
      ? "Stripe: the production key is a TEST key, so sticker checkout is switched off on printyours.ca."
      : "Stripe: no usable production key (it should start sk_live_), so sticker checkout is switched off on printyours.ca.";

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Site stats | Print Yours</title><style>
body{font:15px/1.5 system-ui,sans-serif;margin:0 auto;max-width:860px;padding:24px 16px;color:#0c1a2e;background:#f7f5f0}
h1{margin:0 0 4px}h2{margin:28px 0 8px;font-size:17px}p{margin:4px 0}.none{color:#888}
table{border-collapse:collapse;width:100%;background:#fff;border-radius:12px;overflow:hidden}
th,td{text-align:left;padding:7px 10px;border-bottom:1px solid #eee;vertical-align:top}th{background:#0c1a2e;color:#fff;font-weight:600}
td:last-child{word-break:break-word}a{color:#ff5a1f}</style></head><body>
<h1>Print Yours: what visitors do</h1>
<p><strong>${esc(stripeNote)}</strong></p>
<p>Last 30 days. Page views, referrers and countries are in
<a href="https://dash.cloudflare.com/?to=/:account/web-analytics">Cloudflare Web Analytics</a>.</p>
${table("Events", ["Event", "Count"], byName.results.map((r) => [r.name, r.n]))}
${table("Orders and quotes by where people came from", ["Came from", "What", "Count"], quotesBySource.results.map((r) => [r.source, r.name, r.n]))}
${table("All events by where people came from", ["Came from", "Count"], bySource.results.map((r) => [r.source, r.n]))}
${table("Latest 40", ["When (UTC)", "Event", "Came from", "Page", "Details"], recent.results.map((r) => [r.at, r.name, r.source, r.page, r.detail || ""]))}
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
