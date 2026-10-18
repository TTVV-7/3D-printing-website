// POST /api/sticker-checkout: turns a sticker order from /stickers into a
// Stripe Checkout page and returns its URL.
//
// The card is only authorized (capture_method: manual): the money is held,
// not taken. Capture it in the Stripe dashboard once the order is printed,
// or cancel the hold if it can't be done -- no refund, no fee. Holds lapse
// after 7 days. When the customer comes back, api/sticker-confirm.js emails
// the order.
//
// Env (Vercel > Settings > Environment Variables):
//   STRIPE_SECRET_KEY  sk_test_... while trying it out, sk_live_... to go live
//                      (a variable called just STRIPE works too)
// With no Stripe key this answers 503 and the page shows a "not on yet" note.
//
// Not reached by `npm run dev` (Vite proxies /api to the store backend);
// use `npx vercel dev` or a preview deploy to try a real payment.
import { priceEach, deliveryCost, finishOf, colourOf, deliveryOf, labelName, sizeOf, onSize } from "../src/stickers/pricing.js";
import { RING_GROUPS } from "../src/stickers/library.js";
import { stripe, stripeKey } from "./_stripe.js";

const RING_NAMES = Object.fromEntries([["none", "none"], ...RING_GROUPS.flatMap(([, r]) => r)]);
const MAX_QTY = 1000;
const MAX_ITEMS = 20;
// Only images uploaded through the store backend's Blob store.
const BLOB_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[\w\-./]+\.png$/;

const cents = (cad) => Math.round(cad * 100);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
const short = (v, n = 200) => String(v ?? "").trim().slice(0, n);
const POSTAL = /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/;
const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!stripeKey()) return res.status(503).json({ error: "Payments are not set up yet" });

  const o = req.body || {};
  const delivery = deliveryOf(o.delivery);
  const list = Array.isArray(o.items) ? o.items : [];
  if (!delivery || !list.length || list.length > MAX_ITEMS) return res.status(400).json({ error: "Unknown option" });

  // Each design in the cart, checked and priced here: never trust the page's price.
  const items = [];
  for (const it of list) {
    const finish = finishOf(it?.finish);
    const colour = colourOf(finish, it?.colour);
    const stock = sizeOf(it?.size);
    if (!colour || !stock || !RING_NAMES[it.ring]) return res.status(400).json({ error: "Unknown option" });
    if (!onSize(colour, stock.key)) return res.status(400).json({ error: `${colour.name} isn't sold in ${stock.name}` });
    if (it.ring !== "none" && stock.w !== stock.h) return res.status(400).json({ error: "Rings need a round or square label" });
    const qty = Math.round(clamp(it.qty, 1, MAX_QTY));
    const ink = it.ink || {};
    const label = labelName(finish, colour);
    items.push({
      stock,
      qty,
      unit: cents(priceEach(stock, finish.key, qty)),
      art: BLOB_URL.test(it.art || "") ? it.art : "",
      desc: `${stock.name} label, ${label.toLowerCase()}${it.ring !== "none" ? `, ${RING_NAMES[it.ring].toLowerCase()} ring` : ""}`,
      // Everything needed to print it again, on one line (Stripe allows 500
      // characters per metadata value).
      note: [
        `${qty} x ${stock.name} (${stock.w} x ${stock.h} mm, printer size ${stock.code})`,
        label,
        `ring: ${RING_NAMES[it.ring]}`,
        `ink: ${ink.mode === "dither" ? "dotted" : "solid"}, darkness ${clamp(ink.threshold, 0, 255)}${ink.invert ? ", inverted" : ""}`,
        `file: ${short(it.file, 60) || "(sample)"}`,
        `print file: ${BLOB_URL.test(it.art || "") ? it.art : "(not uploaded)"}`,
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
  if (!name || !email.includes("@")) return res.status(400).json({ error: "Name and email needed" });
  if (address && (!address.line1 || !address.city || !PROVINCES.includes(address.state) || !POSTAL.test(address.postal_code))) {
    return res.status(400).json({ error: "Address incomplete" });
  }

  const subtotal = items.reduce((sum, it) => sum + it.unit * it.qty, 0) / 100;
  const shipping = deliveryCost(delivery, subtotal);
  const count = items.reduce((n, it) => n + it.qty, 0);
  const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;

  const metadata = {
    kind: "sticker",
    name,
    delivery: delivery.key,
    designs: items.length,
    ...Object.fromEntries(items.map((it, i) => [`item${i + 1}`, it.note])),
  };

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      payment_intent_data: {
        capture_method: "manual",
        description: `${count} stickers, ${items.length} design${items.length > 1 ? "s" : ""}`,
        metadata,
        receipt_email: email,
        ...(address && { shipping: { name, address } }),
      },
      line_items: [
        ...items.map((it) => ({
          quantity: it.qty,
          price_data: {
            currency: "cad",
            unit_amount: it.unit,
            product_data: { name: "Custom sticker", description: it.desc, ...(it.art && { images: [it.art] }) },
          },
        })),
        ...(shipping
          ? [{ quantity: 1, price_data: { currency: "cad", unit_amount: cents(shipping), product_data: { name: delivery.name } } }]
          : []),
      ],
      phone_number_collection: { enabled: true },
      metadata,
      success_url: `${origin}/stickers/?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/stickers/`,
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("stripe:", err.message);
    res.status(502).json({ error: "Could not start checkout" });
  }
}
