// Admin charts for /account/ (the Stats tab, src/account/AdminStats.jsx):
// visits, page views, clicks, orders and uploads over time, by hour of the
// day, by page, by where people came from and where they are, and who's
// sending files. Read from the events table (cloudflare/events.js) and the
// orders and users tables (cloudflare/accounts.js).
//
//   GET /api/account/stats?days=30   admins only (anyone else gets a 404)
//
// Times are bucketed in Vancouver time, so "3 pm" means 3 pm in the shop.
import { currentUser, admins } from "./accounts.js";
import { ensureColumns } from "./events.js";

const TZ = "America/Vancouver";
const RANGES = [7, 30, 90, 365];
// Events that mean someone ordered or asked for something.
const ORDER_EVENTS = ["Quote submitted", "Sticker checkout", "Sticker request"];
const KINDS = ["quote", "sticker", "sticker-request", "club"];
// A page view sent as the first page of a visit (a tab), from track().
const LANDING = `(name = 'Page view' AND detail LIKE '%"landing":true%')`;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

// "2026-10-30 17" (UTC) or "2026-10-30 17:04:11" (UTC) -> local date, weekday
// (0 = Monday) and hour. Cached: the same hour comes up many times.
const local = (() => {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hourCycle: "h23" });
  const WEEK = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const cache = new Map();
  return (utc) => {
    const key = utc.slice(0, 13);
    let out = cache.get(key);
    if (!out) {
      const p = Object.fromEntries(fmt.formatToParts(new Date(`${key.replace(" ", "T")}:00:00Z`)).map((x) => [x.type, x.value]));
      out = { date: `${p.year}-${p.month}-${p.day}`, weekday: WEEK[p.weekday], hour: Number(p.hour) % 24 };
      cache.set(key, out);
    }
    return out;
  };
})();

// Every local date in the range, oldest first, ending today.
function dateList(days) {
  const out = [];
  const now = Date.now();
  for (let i = days; i >= 0; i--) {
    const d = local(new Date(now - i * 86400000).toISOString().replace("T", " "));
    if (out[out.length - 1] !== d.date) out.push(d.date);
  }
  return out.slice(-days);
}

const grid = () => Array.from({ length: 7 }, () => Array(24).fill(0));
const parse = (text, fallback) => {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback; // clipped at 500 characters when it was stored
  }
};
const place = (r) => [r.city, r.region, r.country].filter(Boolean).join(", ");

export async function adminStats(request, env) {
  if (!env.DB) return json({ error: "No database bound (DB)" }, 503);
  const user = await currentUser(request, env);
  if (!user || !admins(env).includes(user.email)) return json({ error: "Not found" }, 404);
  await ensureColumns(env);

  const asked = Number(new URL(request.url).searchParams.get("days"));
  const days = RANGES.includes(asked) ? asked : 30;
  const since = `datetime('now', '-${days} days')`;
  const before = `datetime('now', '-${days * 2} days')`;
  const inRange = `at > ${since}`;
  const q = (sql) => env.DB.prepare(sql);
  const orderNames = ORDER_EVENTS.map((n) => `'${n}'`).join(", ");

  const results = await env.DB.batch([
    q(`SELECT strftime('%Y-%m-%d %H', at) h, name, COUNT(*) n, SUM(${LANDING}) visits FROM events WHERE ${inRange} AND name != 'Click' GROUP BY h, name`),
    q(`SELECT DISTINCT strftime('%Y-%m-%d %H', at) h, visitor FROM events WHERE ${inRange} AND visitor IS NOT NULL LIMIT 50000`),
    q(`SELECT page, COUNT(*) n, COUNT(DISTINCT visitor) visitors FROM events WHERE ${inRange} AND name = 'Page view' GROUP BY page ORDER BY n DESC LIMIT 15`),
    q(`SELECT json_extract(detail, '$.label') label, json_extract(detail, '$.href') href, COUNT(*) n, COUNT(DISTINCT page) pages FROM events
       WHERE ${inRange} AND name = 'Click' GROUP BY label, href ORDER BY n DESC LIMIT 15`),
    q(`SELECT source, SUM(${LANDING}) visits, SUM(name IN (${orderNames})) orders FROM events WHERE ${inRange} AND name != 'Click'
       GROUP BY source HAVING visits > 0 OR orders > 0 ORDER BY visits DESC, orders DESC LIMIT 15`),
    q(`SELECT country, COUNT(*) n FROM events WHERE ${inRange} AND name = 'Page view' GROUP BY country ORDER BY n DESC LIMIT 15`),
    q(`SELECT city, region, country, COUNT(*) n, COUNT(DISTINCT visitor) visitors FROM events
       WHERE ${inRange} AND name = 'Page view' AND city IS NOT NULL GROUP BY city, region, country ORDER BY n DESC LIMIT 15`),
    q(`SELECT device, COUNT(*) n FROM events WHERE ${inRange} AND name = 'Page view' GROUP BY device ORDER BY n DESC`),
    q(`SELECT name, COUNT(*) n FROM events WHERE ${inRange} AND name NOT IN ('Page view', 'Click') GROUP BY name ORDER BY n DESC`),
    q(`SELECT COUNT(*) visitors, SUM(visits > 1) came_back FROM (SELECT visitor, COUNT(DISTINCT visit) visits FROM events WHERE ${inRange} AND visitor IS NOT NULL GROUP BY visitor)`),
    q(`SELECT COUNT(*) views, COUNT(visitor) remembered FROM events WHERE ${inRange} AND name = 'Page view'`),
    q(`SELECT SUM(${LANDING}) visits, SUM(name = 'Page view') views FROM events WHERE at > ${before} AND at <= ${since}`),
    q(`SELECT id, email, kind, title, status, total, quantity, files, images, country, region, city, created_at FROM orders
       WHERE created_at > ${since} ORDER BY created_at DESC LIMIT 2000`),
    q(`SELECT COUNT(*) n FROM orders WHERE created_at > ${before} AND created_at <= ${since}`),
    q(`SELECT email, name, created_at FROM users`),
    q(`SELECT at, name, page, source, detail, country, region, city, device FROM events ORDER BY id DESC LIMIT 60`),
  ]);
  const [hourly, visitorHours, pages, clicks, sources, countries, cities, devices, names, returning, remembered, previous, orderRows, previousOrders, users, recent] =
    results.map((r) => r.results);

  const dates = dateList(days);
  const daily = new Map(dates.map((d) => [d, { date: d, visits: 0, pageViews: 0, visitors: 0, quote: 0, sticker: 0, "sticker-request": 0, club: 0, files: 0 }]));
  const heat = { visits: grid(), orders: grid() };
  let pageViews = 0;
  let visits = 0;

  for (const r of hourly) {
    if (r.name !== "Page view") continue;
    const t = local(r.h);
    const day = daily.get(t.date);
    pageViews += r.n;
    visits += r.visits || 0;
    heat.visits[t.weekday][t.hour] += r.visits || 0;
    if (day) {
      day.pageViews += r.n;
      day.visits += r.visits || 0;
    }
  }
  // Distinct remembered visitors per local day.
  const seen = new Map();
  for (const r of visitorHours) {
    const d = local(r.h).date;
    if (!seen.has(d)) seen.set(d, new Set());
    seen.get(d).add(r.visitor);
  }
  for (const [d, set] of seen) if (daily.has(d)) daily.get(d).visitors = set.size;

  const names_ = new Map(users.map((u) => [u.email, u]));
  const customers = new Map();
  let revenue = 0;
  let files = 0;
  const kinds = Object.fromEntries(KINDS.map((k) => [k, 0]));
  const orderPlaces = new Map();
  for (const o of orderRows) {
    const t = local(o.created_at);
    const n = o.files ?? parse(o.images, []).length;
    const day = daily.get(t.date);
    if (day) {
      day[KINDS.includes(o.kind) ? o.kind : "quote"] += 1;
      day.files += n;
    }
    heat.orders[t.weekday][t.hour] += 1;
    kinds[KINDS.includes(o.kind) ? o.kind : "quote"] += 1;
    files += n;
    if (o.status !== "cancelled" && o.total) revenue += Number(o.total) || 0;
    const where = place(o);
    if (where) orderPlaces.set(where, (orderPlaces.get(where) || 0) + 1);

    let c = customers.get(o.email);
    if (!c) {
      c = { email: o.email, name: names_.get(o.email)?.name || null, account: names_.has(o.email), orders: 0, files: 0, total: 0, first: o.created_at, last: o.created_at, places: [], hours: Array(24).fill(0), list: [] };
      customers.set(o.email, c);
    }
    c.orders += 1;
    c.files += n;
    c.total += o.status !== "cancelled" ? Number(o.total) || 0 : 0;
    if (o.created_at < c.first) c.first = o.created_at;
    if (o.created_at > c.last) c.last = o.created_at;
    if (where && !c.places.includes(where)) c.places.push(where);
    c.hours[t.hour] += 1;
    if (c.list.length < 20) c.list.push({ id: o.id, kind: o.kind, title: o.title, status: o.status, at: o.created_at, files: n, total: o.total, place: where });
  }
  const newAccounts = users.filter((u) => u.created_at > new Date(Date.now() - days * 86400000).toISOString().replace("T", " ").slice(0, 19)).length;

  return json({
    days,
    tz: TZ,
    totals: {
      visits,
      pageViews,
      visitors: returning[0]?.visitors || 0,
      returning: returning[0]?.came_back || 0,
      remembered: remembered[0]?.views ? remembered[0].remembered / remembered[0].views : 0,
      orders: orderRows.length,
      kinds,
      files,
      uploaders: [...customers.values()].filter((c) => c.files > 0).length,
      revenue: Math.round(revenue * 100) / 100,
      newAccounts,
    },
    previous: { visits: previous[0]?.visits || 0, pageViews: previous[0]?.views || 0, orders: previousOrders[0]?.n || 0 },
    daily: [...daily.values()],
    heat,
    pages,
    clicks: clicks.map((c) => ({ ...c, label: c.label || c.href || "(no label)" })),
    sources,
    countries,
    cities,
    orderPlaces: [...orderPlaces].map(([where, n]) => ({ where, n })).sort((a, b) => b.n - a.n).slice(0, 15),
    devices,
    events: names,
    customers: [...customers.values()].sort((a, b) => b.last.localeCompare(a.last)),
    recent: recent.map((r) => ({ ...r, detail: parse(r.detail, null), place: place(r) })),
  });
}
