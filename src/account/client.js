// Browser side of customer accounts (server: cloudflare/accounts.js). Only in
// the Cloudflare build, where `npm run build:cf` sets VITE_ACCOUNTS.
import { isColour, itemLabel, itemSizeName } from "../stickers/pricing.js";

export const ACCOUNTS = import.meta.env.VITE_ACCOUNTS === "1";

// Who's signed in, asked once per page.
let mine;
export function fetchMe() {
  if (!ACCOUNTS) return Promise.resolve({ user: null });
  mine ??= fetch("/api/account/me", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : { user: null }))
    .catch(() => ({ user: null }));
  return mine;
}
export const refreshMe = () => {
  mine = undefined;
  return fetchMe();
};

// Stores one PNG data URL privately (api/sticker-upload.js) and returns its
// link, or "" if it couldn't.
async function upload(dataUrl, name) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")) return "";
  try {
    const r = await fetch("/api/sticker-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, data: dataUrl }),
    });
    // A path on this site, so a saved design works on any of its addresses.
    const url = (await r.json()).url;
    return url ? new URL(url, location.origin).pathname + new URL(url, location.origin).search : "";
  } catch {
    return "";
  }
}

// Saves sticker designs a signed-in customer puts in their cart, so they can
// order them again from their account. Pictures go up as links; the rest of
// the cart line is kept as it is.
const saving = new Set();
export async function saveDesigns(items) {
  items = items.filter((it) => !saving.has(it.id));
  if (!ACCOUNTS || !items.length) return;
  items.forEach((it) => saving.add(it.id));
  if (!(await fetchMe()).user) return;
  for (const it of items) {
    const name = `design-${String(it.id).replace(/[^\w-]/g, "").slice(0, 30) || Date.now()}`;
    const art = it.art?.startsWith("data:") ? await upload(it.art, `${name}-art`) : it.art;
    if (!art) continue;
    const print = it.print?.startsWith("data:") ? await upload(it.print, `${name}-print`) : it.print;
    const data = { ...it, art, ...(print ? { print } : {}) };
    for (const k of Object.keys(data)) if (typeof data[k] === "string" && data[k].startsWith("data:")) delete data[k];
    await fetch("/api/account/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: String(it.id).replace(/[^\w-]/g, "").slice(0, 60) || undefined,
        kind: isColour(it) ? "colour" : "thermal",
        title: `${itemSizeName(it)} · ${itemLabel(it)}`,
        preview: art,
        data,
      }),
    }).catch(() => {});
  }
}

async function toDataUrl(url) {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Puts a saved design back in the sticker cart (the cart lives in
// localStorage; see useCart in src/stickers/StickerStudio.jsx).
export async function reorder(design) {
  const it = { ...design.data, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
  it.art = await toDataUrl(it.art);
  if (it.print?.startsWith("/api/")) it.print = await toDataUrl(it.print);
  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem("sticker-cart")) || [];
  } catch {
    // Nothing saved yet.
  }
  localStorage.setItem("sticker-cart", JSON.stringify([...cart, it].slice(-20)));
  location.href = isColour(it) ? "/stickers/#colour" : "/stickers/";
}
