// Customer accounts (Cloudflare only): sign in with Google or an emailed link,
// then /account/ shows every quote and sticker order sent from that email,
// with its status, and the sticker designs they made. Everything lives in the
// D1 database bound as DB (tables in cloudflare/schema.sql).
//
//   GET  /api/auth/google            start Google sign-in, and its return
//                                    address (GOOGLE_CLIENT_ID / _SECRET)
//   POST /api/auth/email {email}     email a sign-in link (Turnstile-checked)
//   GET  /api/auth/email?t=...       the link itself
//   POST /api/auth/logout
//   GET  /api/account/me             who's signed in, their orders and designs
//   POST /api/account/designs        save a design {kind, title, preview, data}
//   DELETE /api/account/designs?id=
//   GET  /api/account/orders         every order (admins only)
//   POST /api/account/orders         set an order's status {id, status, note,
//                                    tracking}; "shipped" and "ready" email the
//                                    customer (admins only)
//
// Admins are the emails in ADMIN_EMAILS (comma-separated), or site.admins.
// Orders are recorded by recordOrder() as they're filed: quotes as the Worker
// passes them to the store backend, sticker orders from api/_sticker-order.js.
import { site } from "../site.config.js";
import { esc, layout, sendMail, EMAIL } from "../api/_mail.js";
import { ensureColumns } from "./events.js";

const SESSION_DAYS = 60;
const LINK_MINUTES = 20;
const LINKS_PER_EMAIL_PER_DAY = 5;

export const STATUSES = {
  received: "Received",
  quoted: "Quote sent",
  paid: "Paid",
  printing: "Printing",
  ready: "Ready for pickup",
  shipped: "Shipped",
  done: "Done",
  cancelled: "Cancelled",
};

const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

function cookies(request) {
  const out = {};
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// On printyours.ca the session covers every subdomain (the designer too).
function cookie(request, name, value, maxAge) {
  const host = new URL(request.url).hostname;
  const domain = host === "printyours.ca" || host.endsWith(".printyours.ca") ? "; Domain=printyours.ca" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}${domain}`;
}

const random = () => {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function sha(text) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const normal = (email) => String(email || "").trim().toLowerCase();
// Only paths on this site, so a sign-in link can't send someone elsewhere.
const safeNext = (next) => (typeof next === "string" && /^\/(?!\/)[\w\-./?=&#%]*$/.test(next) ? next : "/account/");
export const admins = (env) =>
  (env.ADMIN_EMAILS || (site.admins || []).join(",") || site.email || "")
    .split(",")
    .map(normal)
    .filter(Boolean);

export async function currentUser(request, env) {
  const token = cookies(request).py_session;
  if (!token || !env.DB) return null;
  const row = await env.DB.prepare(
    "SELECT u.id, u.email, u.name, u.picture FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > datetime('now')",
  )
    .bind(await sha(token))
    .first();
  return row || null;
}

// Whether this request comes from a signed-in admin. Cheap for everyone
// else: no session cookie, no database lookup.
export async function isAdmin(request, env) {
  if (!cookies(request).py_session) return false;
  const user = await currentUser(request, env);
  return Boolean(user && admins(env).includes(user.email));
}

// Signs in `email` (making the account the first time) and sends them on.
async function signIn(request, env, { email, name, picture }, next) {
  email = normal(email);
  let user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (!user) {
    user = { id: crypto.randomUUID() };
    await env.DB.prepare("INSERT INTO users (id, email, name, picture) VALUES (?, ?, ?, ?)").bind(user.id, email, name || null, picture || null).run();
  } else if (name || picture) {
    await env.DB.prepare("UPDATE users SET name = COALESCE(?, name), picture = COALESCE(?, picture) WHERE id = ?").bind(name || null, picture || null, user.id).run();
  }
  const token = random();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`).bind(await sha(token), user.id),
    env.DB.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')"),
  ]);
  const headers = new Headers({ location: safeNext(next), "cache-control": "no-store" });
  headers.append("set-cookie", cookie(request, "py_session", token, SESSION_DAYS * 86400));
  headers.append("set-cookie", cookie(request, "py_next", "", 0));
  return new Response(null, { status: 302, headers });
}

const back = (msg) => new Response(null, { status: 302, headers: { location: `/account/?error=${encodeURIComponent(msg)}` } });

// ---- Google ---------------------------------------------------------------

async function google(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return back("Google sign-in isn't switched on yet. Use the email link instead.");
  const url = new URL(request.url);
  const redirect = `${url.origin}/api/auth/google`;
  const code = url.searchParams.get("code");

  if (!code) {
    if (url.searchParams.get("error")) return back("Google sign-in was cancelled.");
    const state = random();
    const to = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    to.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirect,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    const headers = new Headers({ location: to.toString() });
    headers.append("set-cookie", cookie(request, "py_state", state, 600));
    headers.append("set-cookie", cookie(request, "py_next", safeNext(url.searchParams.get("next")), 600));
    return new Response(null, { status: 302, headers });
  }

  const jar = cookies(request);
  if (!jar.py_state || jar.py_state !== url.searchParams.get("state")) return back("That sign-in expired. Try again.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const tokens = await res.json().catch(() => ({}));
  if (!res.ok || !tokens.id_token) {
    console.error("google sign-in:", res.status, tokens.error, tokens.error_description);
    return back("Google sign-in didn't work. Try again, or use the email link.");
  }
  // The ID token came straight from Google over HTTPS in exchange for the
  // code, so its contents can be trusted without checking the signature.
  const part = tokens.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part), (c) => c.charCodeAt(0))));
  if (claims.aud !== env.GOOGLE_CLIENT_ID || !claims.email || !claims.email_verified) return back("That Google account has no confirmed email.");
  const r = await signIn(request, env, { email: claims.email, name: claims.name, picture: claims.picture }, jar.py_next);
  r.headers.append("set-cookie", cookie(request, "py_state", "", 0));
  return r;
}

// ---- Email link -----------------------------------------------------------

async function emailLink(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const t = url.searchParams.get("t") || "";
    const hash = await sha(t);
    const row = await env.DB.prepare("SELECT email, next FROM login_links WHERE token_hash = ? AND expires_at > datetime('now')").bind(hash).first();
    if (!row) return back("That sign-in link has expired or was already used. Send yourself a new one.");
    await env.DB.prepare("DELETE FROM login_links WHERE token_hash = ? OR expires_at < datetime('now')").bind(hash).run();
    return signIn(request, env, { email: row.email }, row.next);
  }
  if (request.method !== "POST") return json({ error: "POST only" }, 405);

  const body = await request.json().catch(() => ({}));
  const email = normal(body.email);
  if (!EMAIL.test(email) || email.length > 200) return json({ error: "That email doesn't look right." }, 400);
  if (env.AI_LIMITS) {
    const key = `login:${new Date().toISOString().slice(0, 10)}:${email}`;
    const n = Number((await env.AI_LIMITS.get(key)) || 0);
    if (n >= LINKS_PER_EMAIL_PER_DAY) return json({ error: "Too many sign-in links today. Check your inbox for an earlier one." }, 429);
    await env.AI_LIMITS.put(key, String(n + 1), { expirationTtl: 2 * 86400 });
  }
  const token = random();
  await env.DB.prepare(`INSERT INTO login_links (token_hash, email, next, expires_at) VALUES (?, ?, ?, datetime('now', '+${LINK_MINUTES} minutes'))`)
    .bind(await sha(token), email, safeNext(body.next))
    .run();
  const link = `${url.origin}/api/auth/email?t=${token}`;
  const sent = await sendMail({
    to: email,
    subject: "Your Print Yours sign-in link",
    html: layout({
      heading: "Sign in to Print Yours",
      intro: `Tap the button to see your orders and designs. The link works once, for ${LINK_MINUTES} minutes.`,
      body: `<p style="margin:0 0 8px"><a href="${esc(link)}" style="display:inline-block;background:#ff5b1f;color:#fff;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px">Sign in</a></p>
<p style="margin:12px 0 0;font-size:13px;color:#7a8494">Didn't ask for this? You can ignore it; nobody can sign in without this email.</p>`,
    }),
    text: `Sign in to Print Yours (works once, for ${LINK_MINUTES} minutes):\n${link}\n\nDidn't ask for this? You can ignore it.`,
  });
  if (!sent) return json({ error: "The email didn't send. Try Google sign-in, or try again in a minute." }, 502);
  return json({ ok: true });
}

async function logout(request, env) {
  const token = cookies(request).py_session;
  if (token && env.DB) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha(token)).run();
  return json({ ok: true }, 200, { "set-cookie": cookie(request, "py_session", "", 0) });
}

// ---- Orders and designs ---------------------------------------------------

// "/api/sticker-file?p=..." from a full or relative link to a stored file
// (uploads hand back full links with the site's address), or null.
const filePath = (u) => (typeof u === "string" && /\/api\/sticker-file\?p=[\w%.\-()!*'~]+/.exec(u)?.[0]) || null;
// Pictures only: print files (stickers/...) and images people attached.
const isPicture = (path) => /p=stickers%2F/.test(path) || /\.(png|jpe?g|webp|gif)$/i.test(path);

const orderOut = (o) => ({ ...o, images: o.images ? JSON.parse(o.images) : [], statusName: STATUSES[o.status] || o.status });

// Called as an order is filed. `entry` is the quote-form shape
// (src/components/QuoteForm.jsx / api/_sticker-order.js fileOrder); `cf` is
// the customer's request.cf, for the rough place it was sent from (country,
// region, city: Cloudflare's guess from the connection).
export async function recordOrder(env, entry, cf = {}) {
  if (!env.DB || !entry?.id || !EMAIL.test(entry.email || "")) return;
  const id = String(entry.id).slice(0, 80);
  const kind = id.startsWith("sticker-request")
    ? "sticker-request"
    : id.startsWith("sticker-")
      ? "sticker"
      : /^clubs/i.test(entry.title || "")
        ? "club"
        : "quote";
  const images = (Array.isArray(entry.files) ? entry.files : [])
    .filter((f) => !/original/.test(f?.name || ""))
    .map((f) => filePath(f?.url))
    .filter((path) => path && isPicture(path))
    .slice(0, 8);
  const thumb = filePath(entry.thumbnailUrl) || images[0] || null;
  const files = Array.isArray(entry.files) ? entry.files.filter((f) => f?.url && !/original/.test(f.name || "")).length : 0;
  const place = (v, n) => (typeof v === "string" && v ? v.slice(0, n) : null);
  try {
    await ensureColumns(env);
    await env.DB.prepare(
      "INSERT OR IGNORE INTO orders (id, email, kind, title, status, quantity, total, thumbnail, images, files, country, region, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        normal(entry.email),
        kind,
        String(entry.title || "").slice(0, 200),
        kind === "sticker" ? "paid" : "received",
        Number(entry.quantity) || 1,
        Number.isFinite(Number(entry.totalCost)) ? Number(entry.totalCost) : null,
        thumb,
        JSON.stringify(images),
        files,
        place(cf?.country, 2),
        place(cf?.region, 60),
        place(cf?.city, 60),
      )
      .run();
  } catch (err) {
    console.error("recordOrder:", err.message);
  }
}

async function me(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ user: null });
  const [orders, designs] = await Promise.all([
    env.DB.prepare("SELECT * FROM orders WHERE email = ? ORDER BY created_at DESC LIMIT 100").bind(user.email).all(),
    env.DB.prepare("SELECT id, kind, title, preview, data, created_at FROM designs WHERE user_id = ? ORDER BY created_at DESC LIMIT 60").bind(user.id).all(),
  ]);
  return json({
    user,
    admin: admins(env).includes(user.email),
    statuses: STATUSES,
    orders: orders.results.map(orderOut),
    designs: designs.results.map((d) => ({ ...d, data: JSON.parse(d.data) })),
  });
}

async function designs(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: "Sign in first" }, 401);
  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM designs WHERE id = ? AND user_id = ?").bind(new URL(request.url).searchParams.get("id") || "", user.id).run();
    return json({ ok: true });
  }
  if (request.method !== "POST") return json({ error: "POST or DELETE" }, 405);
  const body = await request.json().catch(() => ({}));
  const data = JSON.stringify(body.data ?? null);
  // Designs keep links to their pictures, never the pictures themselves.
  if (!body.data || data.length > 20000 || data.includes("data:image")) return json({ error: "Not a design" }, 400);
  const preview = filePath(body.preview);
  const id = typeof body.id === "string" && /^[\w-]{1,60}$/.test(body.id) ? `${user.id.slice(0, 8)}-${body.id}` : crypto.randomUUID();
  await env.DB.prepare("INSERT OR REPLACE INTO designs (id, user_id, kind, title, preview, data) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, user.id, String(body.kind || "sticker").slice(0, 20), String(body.title || "").slice(0, 120), preview, data)
    .run();
  return json({ ok: true, id });
}

async function adminOrders(request, env) {
  const user = await currentUser(request, env);
  if (!user || !admins(env).includes(user.email)) return json({ error: "Not found" }, 404);
  if (request.method === "GET") {
    const rows = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200").all();
    return json({ orders: rows.results.map(orderOut), statuses: STATUSES });
  }
  if (request.method !== "POST") return json({ error: "GET or POST" }, 405);
  const body = await request.json().catch(() => ({}));
  if (!STATUSES[body.status]) return json({ error: "Unknown status" }, 400);
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(String(body.id || "")).first();
  if (!order) return json({ error: "No such order" }, 404);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : order.note;
  const tracking = typeof body.tracking === "string" ? body.tracking.trim().slice(0, 200) : order.tracking;
  await env.DB.prepare("UPDATE orders SET status = ?, note = ?, tracking = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(body.status, note || null, tracking || null, order.id)
    .run();

  let emailed = false;
  if (body.status !== order.status && (body.status === "shipped" || body.status === "ready") && body.notify !== false) {
    const origin = new URL(request.url).origin;
    const shipped = body.status === "shipped";
    const heading = shipped ? "Your order is on its way" : "Your order is ready for pickup";
    const intro = shipped
      ? `${esc(order.title || "Your order")} has shipped.${tracking ? ` Tracking: <strong>${esc(tracking)}</strong>.` : ""}`
      : `${esc(order.title || "Your order")} is printed and ready. Reply to this email to arrange a pickup time.`;
    emailed = await sendMail({
      to: order.email,
      subject: shipped ? "Your Print Yours order has shipped" : "Your Print Yours order is ready for pickup",
      html: layout({
        heading,
        intro,
        body: `${note ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.55">${esc(note)}</p>` : ""}${
          order.thumbnail ? `<img src="${esc(origin + order.thumbnail)}" alt="" width="160" style="display:block;border-radius:12px;margin:0 0 16px;max-width:160px">` : ""
        }<p style="margin:0"><a href="${esc(origin)}/account/" style="color:#ff5b1f;font-weight:700">See your orders</a></p>`,
      }),
      text: `${heading}.\n${order.title || ""}${tracking ? `\nTracking: ${tracking}` : ""}${note ? `\n\n${note}` : ""}\n\nSee your orders: ${origin}/account/`,
    });
  }
  return json({ ok: true, emailed });
}

const needsDb = (fn) => (request, env) => (env.DB ? fn(request, env) : json({ error: "Accounts aren't switched on here" }, 503));

export const accountRoutes = {
  "auth/google": needsDb(google),
  "auth/email": needsDb(emailLink),
  "auth/logout": logout,
  "account/me": needsDb(me),
  "account/designs": needsDb(designs),
  "account/orders": needsDb(adminOrders),
};
