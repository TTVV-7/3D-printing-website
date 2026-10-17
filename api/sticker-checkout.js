// POST /api/sticker-checkout: turns a sticker order from /stickers into a
// Stripe Checkout page and returns its URL.
//
// The card is only authorized (capture_method: manual): the money is held,
// not taken. Capture it in the Stripe dashboard once the order is printed,
// or cancel the hold if it can't be done -- no refund, no fee. Holds lapse
// after 7 days.
//
// Env (Vercel > Settings > Environment Variables):
//   STRIPE_SECRET_KEY      sk_test_... while trying it out, sk_live_... to go live
//                          (a variable called just STRIPE works too)
//   BLOB_READ_WRITE_TOKEN  optional; set by connecting a Vercel Blob store.
//                          Without it the order still goes through, minus the
//                          print-ready image link.
// With no Stripe key this answers 503 and the page shows its mock checkout.
//
// Not reached by `npm run dev` (Vite proxies /api to the store backend);
// use `npx vercel dev` or a preview deploy to try a real payment.
import Stripe from "stripe";
import { put } from "@vercel/blob";
import { stickers } from "../site.config.js";
import { priceEach } from "../src/stickers/pricing.js";

const SHAPES = ["rect", "rounded", "circle"];
const MAX_QTY = 1000;

const cents = (cad) => Math.round(cad * 100);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));

const stripeKey = () => process.env.STRIPE_SECRET_KEY || process.env.STRIPE;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!stripeKey()) return res.status(503).json({ error: "Payments are not set up yet" });

  const o = req.body || {};
  const paper = stickers.papers.find((p) => p.key === o.paper);
  const finish = stickers.finishes.find((f) => f.key === o.finish);
  if (!paper || !finish || !SHAPES.includes(o.shape)) return res.status(400).json({ error: "Unknown option" });

  // Never trust the page's price: rebuild it from the order.
  const w = clamp(o.w, stickers.minWidthMm, 400);
  const h = clamp(o.h, 5, 400);
  if (Math.min(w, h) > stickers.maxWidthMm) return res.status(400).json({ error: "Too wide for the printer" });
  const qty = Math.round(clamp(o.qty, 1, MAX_QTY));
  const each = priceEach({ w, h }, finish.key, qty);

  // The print-ready image, so the order can be printed as previewed.
  let artUrl = "";
  if (process.env.BLOB_READ_WRITE_TOKEN && typeof o.art === "string" && o.art.startsWith("data:image/png;base64,")) {
    const png = Buffer.from(o.art.slice(22), "base64");
    if (png.length < 4 * 1024 * 1024) {
      const blob = await put(`stickers/${Date.now()}.png`, png, { access: "public", contentType: "image/png", addRandomSuffix: true });
      artUrl = blob.url;
    }
  }

  const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  const desc = `${w} × ${h} mm ${o.shape === "rect" ? "rectangle" : o.shape}, ${paper.name.toLowerCase()} paper, ${finish.name.toLowerCase()}`;
  const stripe = new Stripe(stripeKey());

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_intent_data: {
        capture_method: "manual",
        description: `${qty} × sticker, ${desc}`,
        metadata: { art: artUrl },
      },
      line_items: [
        {
          quantity: qty,
          price_data: {
            currency: "cad",
            unit_amount: cents(each),
            product_data: { name: "Custom sticker", description: desc, ...(artUrl && { images: [artUrl] }) },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: ["CA"] },
      shipping_options: stickers.shipping.map((s) => ({
        shipping_rate_data: {
          display_name: s.name,
          type: "fixed_amount",
          fixed_amount: { amount: cents(s.amount), currency: "cad" },
          delivery_estimate: {
            minimum: { unit: "business_day", value: s.days[0] },
            maximum: { unit: "business_day", value: s.days[1] },
          },
        },
      })),
      phone_number_collection: { enabled: true },
      metadata: { kind: "sticker", w, h, shape: o.shape, paper: paper.key, finish: finish.key, qty, art: artUrl },
      success_url: `${origin}/stickers/?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/stickers/`,
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("stripe:", err.message);
    res.status(502).json({ error: "Could not start checkout" });
  }
}
