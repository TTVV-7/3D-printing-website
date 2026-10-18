// Shared by the sticker order functions: checking an order sent from the
// /stickers page, and filing one with the store backend (its admin panel and
// order email). The leading underscore keeps Vercel from serving this file as
// a function of its own.
import { priceEach, deliveryCost, finishOf, colourOf, deliveryOf, labelName, sizeOf, onSize } from "../src/stickers/pricing.js";
import { stickers } from "../site.config.js";
import { RING_GROUPS } from "../src/stickers/library.js";
import { STORE_API } from "./_stripe.js";

const RING_NAMES = Object.fromEntries([["none", "none"], ...RING_GROUPS.flatMap(([, r]) => r)]);
const MAX_QTY = 1000;
const MAX_ITEMS = 20;
// Only print files stored by api/sticker-upload.js, linked through this site.
const FILE_PATH = /^\/api\/sticker-file\?p=stickers%2F[\w-]+%2F[\w-]+\.png$/;

export const cents = (cad) => Math.round(cad * 100);
export const money = (c) => `$${(c / 100).toFixed(2)}`;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
export const short = (v, n = 200) => String(v ?? "").trim().slice(0, n);
const POSTAL = /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/;
const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

export const originOf = (req) => `https://${req.headers["x-forwarded-host"] || req.headers.host}`;

// The cart, customer and delivery from the page, checked and priced here:
// never trust the page's price. Returns { error } or the order.
export function readOrder(body, origin) {
  const o = body || {};
  const isFile = (u) => typeof u === "string" && u.startsWith(origin) && FILE_PATH.test(u.slice(origin.length));
  const delivery = deliveryOf(o.delivery);
  const list = Array.isArray(o.items) ? o.items : [];
  if (!delivery || !list.length || list.length > MAX_ITEMS) return { error: "Unknown option" };

  const items = [];
  for (const it of list) {
    const finish = finishOf(it?.finish);
    const colour = colourOf(finish, it?.colour);
    const stock = sizeOf(it?.size);
    if (!colour || !stock || !RING_NAMES[it.ring]) return { error: "Unknown option" };
    if (!onSize(colour, stock.key)) return { error: `${colour.name} isn't sold in ${stock.name}` };
    if (it.ring !== "none" && stock.w !== stock.h) return { error: "Rings need a round or square label" };
    const qty = Math.round(clamp(it.qty, 1, MAX_QTY));
    const ink = it.ink || {};
    const label = labelName(finish, colour);
    items.push({
      stock,
      qty,
      unit: cents(priceEach(stock, finish.key, qty)),
      art: isFile(it.art) ? it.art : "",
      desc: `${stock.name} label, ${label.toLowerCase()}${it.ring !== "none" ? `, ${RING_NAMES[it.ring].toLowerCase()} ring` : ""}`,
      // Everything needed to print it again, on one line (Stripe allows 500
      // characters per metadata value).
      note: [
        `${qty} x ${stock.name} (${stock.w} x ${stock.h} mm, printer size ${stock.code})`,
        label,
        `ring: ${RING_NAMES[it.ring]}`,
        `ink: ${ink.mode === "dither" ? "dotted" : "solid"}, darkness ${clamp(ink.threshold, 0, 255)}${ink.invert ? ", inverted" : ""}`,
        `file: ${short(it.file, 60) || "(sample)"}`,
        `print file: ${isFile(it.art) ? it.art : "(not uploaded)"}`,
      ].join(" | ").slice(0, 500),
    });
  }
  const mailed = delivery.key !== "pickup";

  // Name, email and (when mailed) the address, typed on the page.
  const c = o.customer || {};
  const name = short(c.name, 100);
  const email = short(c.email, 200);
  const a = c.address || {};
  const address = mailed && {
    line1: short(a.line1),
    line2: short(a.line2),
    city: short(a.city, 100),
    state: short(a.state, 2),
    postal_code: short(a.postal_code, 7).toUpperCase(),
    country: "CA",
  };
  if (!name || !email.includes("@")) return { error: "Name and email needed" };
  if (address && (!address.line1 || !address.city || !PROVINCES.includes(address.state) || !POSTAL.test(address.postal_code))) {
    return { error: "Address incomplete" };
  }

  const subtotal = items.reduce((sum, it) => sum + it.unit * it.qty, 0) / 100;
  return {
    items,
    delivery,
    name,
    email,
    address: address || null,
    shipping: deliveryCost(delivery, subtotal),
    subtotal,
    count: items.reduce((n, it) => n + it.qty, 0),
  };
}

const imageOf = (note) => note.match(/print file: (https:\S+)/)?.[1];
const qtyOf = (note) => Number(note.match(/^(\d+) x/)?.[1]) || 0;
// The label roll, as the Sticker Printer app names it ("matte-pink"), from
// the label name in a note ("Pink matte").
const LABEL_KEYS = Object.fromEntries(
  stickers.finishes.flatMap((f) => f.colours.map((c) => [labelName(f, c), `${f.key}-${c.key}`])),
);
// Opens the design in the in-shop Sticker Printer app (TTVV-7/Stickers,
// running on this computer at port 8420) on the right label, roll colour and
// copies.
const appLink = (note) => {
  const file = imageOf(note);
  const code = note.match(/printer size (w\d+h\d+)/)?.[1];
  if (!file || !code) return null;
  const label = LABEL_KEYS[note.split(" | ")[1]];
  return `http://127.0.0.1:8420/?import=${encodeURIComponent(file)}&size=${code}&copies=${Math.min(50, qtyOf(note))}${label ? `&label=${label}` : ""}`;
};

// Saves the order in the store backend and sends the order email. `notes`
// are the items' one-line notes; `heading` the lines above them; `footer`
// the lines after the customer.
export async function fileOrder({ id, title, heading, notes, delivery, shipTo, phone, name, email, footer, budget, total }) {
  const count = notes.reduce((n, note) => n + qtyOf(note), 0);
  const addr = shipTo?.address;
  const details = [
    ...heading,
    ``,
    `To print: with the Sticker Printer app running, click "open in Sticker Printer" under each design.`,
    `It opens on the right label size and copies; check it, then Print. (The app prints up to 50 copies at a time.)`,
    ``,
    `${notes.length} design${notes.length > 1 ? "s" : ""}, ${count} stickers:`,
    ...notes.flatMap((note, i) => [
      ``,
      `${i + 1}. ${note.split(" | ").join("\n   ")}`,
      ...(appLink(note) ? [`   open in Sticker Printer: ${appLink(note)}`] : []),
    ]),
    ``,
    `Delivery: ${delivery?.name || "-"}`,
    ...(addr
      ? [`Ship to: ${shipTo.name}`, addr.line1, addr.line2, `${addr.city}, ${addr.state} ${addr.postal_code}`].filter(Boolean)
      : []),
    ...(phone ? [`Phone: ${phone}`] : []),
    ``,
    `Customer: ${name} <${email}>`,
    ...(footer.length ? [``, ...footer] : []),
  ].join("\n");

  // Same shape the quote form sends (src/components/QuoteForm.jsx).
  const entry = {
    id,
    mode: "description",
    name,
    email,
    details,
    url: null,
    material: "Sticker",
    quality: null,
    quantity: count || 1,
    deadline: null,
    budget,
    files: notes
      .map((note, i) => imageOf(note) && { name: `sticker-${i + 1}.png`, size: 0, url: imageOf(note) })
      .filter(Boolean),
    title: `${title}: ${count} stickers, ${notes.length} design${notes.length > 1 ? "s" : ""}`,
    stlName: null,
    thumbnailUrl: imageOf(notes[0] || "") || null,
    weightG: null,
    printTimeHrs: null,
    filamentCost: null,
    timeCost: null,
    totalCost: total,
    submittedAt: new Date().toISOString(),
  };

  const post = (path) =>
    fetch(`${STORE_API}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  const saved = await post("print-requests");
  if (!saved.ok) throw new Error(`print-requests ${saved.status}`);
  const mailed = await post("notify-request");
  if (!mailed.ok) throw new Error(`notify-request ${mailed.status}`);
}
