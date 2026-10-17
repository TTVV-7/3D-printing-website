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
import { priceEach, deliveryCost, finishOf, colourOf, deliveryOf, labelName, sizeOf } from "../src/stickers/pricing.js";
import { DESIGNS, RING_GROUPS } from "../src/stickers/library.js";
import { stripe, stripeKey } from "./_stripe.js";

const DESIGN_NAMES = Object.fromEntries([["none", "none"], ...DESIGNS]);
const RING_NAMES = Object.fromEntries([["none", "none"], ...RING_GROUPS.flatMap(([, r]) => r)]);
const seedOf = (v) => Math.floor(clamp(v, 0, 1e9));
const MAX_QTY = 1000;
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
  const finish = finishOf(o.finish);
  const colour = colourOf(finish, o.colour);
  const delivery = deliveryOf(o.delivery);
  const stock = sizeOf(o.size);
  if (!colour || !delivery || !stock || !DESIGN_NAMES[o.pattern] || !RING_NAMES[o.ring]) {
    return res.status(400).json({ error: "Unknown option" });
  }
  if (o.ring !== "none" && stock.w !== stock.h) return res.status(400).json({ error: "Rings need a round or square label" });
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

  // Never trust the page's price: rebuild it from the order.
  const { w, h } = stock;
  const qty = Math.round(clamp(o.qty, 1, MAX_QTY));
  const each = priceEach({ w, h }, finish.key, qty);
  const unit = cents(each);
  const shipping = deliveryCost(delivery, (unit * qty) / 100);
  const art = BLOB_URL.test(o.art || "") ? o.art : "";
  const ink = o.ink || {};

  const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  const label = labelName(finish, colour);
  const desc = `${stock.name} label, ${label.toLowerCase()}`;

  // Everything needed to print it again, kept on the payment in Stripe.
  const metadata = {
    kind: "sticker",
    size: `${stock.name} (${w} x ${h} mm, printer size ${stock.code})`,
    design: o.pattern === "none" ? "none" : `${DESIGN_NAMES[o.pattern]} (seed ${seedOf(o.patternSeed)})`,
    ring: RING_NAMES[o.ring],
    label,
    name,
    qty,
    delivery: delivery.key,
    ink: `${ink.mode === "dither" ? "dotted" : "solid"}, darkness ${clamp(ink.threshold, 0, 255)}${ink.invert ? ", inverted" : ""}`,
    file: short(o.file),
    art,
  };

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      payment_intent_data: {
        capture_method: "manual",
        description: `${qty} × sticker, ${desc}`,
        metadata,
        receipt_email: email,
        ...(address && { shipping: { name, address } }),
      },
      line_items: [
        {
          quantity: qty,
          price_data: {
            currency: "cad",
            unit_amount: unit,
            product_data: { name: "Custom sticker", description: desc, ...(art && { images: [art] }) },
          },
        },
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
