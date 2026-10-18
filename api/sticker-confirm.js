// POST /api/sticker-confirm { session }: called by /stickers when the customer
// lands back from Stripe. Checks with Stripe that the card really was
// authorized, then files the order with the store backend -- the same admin
// panel and email notification as a quote request -- with every setting, the
// customer's details and the print-ready image.
//
// Runs once per order: the payment is marked `notified` in Stripe, so a
// reload doesn't send a second email. If the customer closes the tab before
// landing back, the order is still in Stripe (and Stripe's own payment
// email, if that's switched on in its settings), just not emailed from here.
import { deliveryOf } from "../src/stickers/pricing.js";
import { fileOrder, money } from "./_sticker-order.js";
import { stripe, stripeKey } from "./_stripe.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!stripeKey()) return res.status(503).json({ error: "Payments are not set up yet" });
  const id = String(req.body?.session || "");
  if (!/^cs_(test|live)_\w+$/.test(id)) return res.status(400).json({ error: "Bad session" });

  const s = stripe();
  let session;
  try {
    session = await s.checkout.sessions.retrieve(id, { expand: ["payment_intent"] });
  } catch {
    return res.status(404).json({ error: "No such order" });
  }
  const pi = session.payment_intent;
  const m = session.metadata || {};
  if (m.kind !== "sticker" || !pi || !["requires_capture", "succeeded"].includes(pi.status)) {
    return res.status(409).json({ error: "Not paid" });
  }
  if (pi.metadata?.notified) return res.status(200).json({ ok: true });

  const c = session.customer_details || {};
  const live = id.startsWith("cs_live_");
  const dashboard = `https://dashboard.stripe.com/${live ? "" : "test/"}payments/${pi.id}`;
  // One line per design in the cart: item1, item2, ... (api/sticker-checkout.js).
  const notes = Object.keys(m)
    .filter((k) => /^item\d+$/.test(k))
    .sort((a, b) => a.slice(4) - b.slice(4))
    .map((k) => m[k]);

  try {
    await fileOrder({
      id: `sticker-${pi.id}`,
      title: "Sticker order (paid)",
      heading: [
        `PAID STICKER ORDER${live ? "" : " (Stripe TEST mode, no real money)"}`,
        `Card held, not charged yet: capture it in Stripe once printed, or cancel the hold.`,
        dashboard,
      ],
      notes,
      delivery: deliveryOf(m.delivery),
      shipTo: pi.shipping,
      phone: c.phone || "-",
      name: m.name || c.name || "Sticker customer",
      email: session.customer_email || c.email || "",
      footer: [`Total held: ${money(session.amount_total)} CAD`],
      budget: `Paid ${money(session.amount_total)} (held)`,
      total: session.amount_total / 100,
    });
    await s.paymentIntents.update(pi.id, { metadata: { notified: new Date().toISOString() } });
  } catch (err) {
    // The order is safe in Stripe either way; this only loses the email.
    console.error("sticker order not filed:", err.message);
    return res.status(502).json({ error: "Order saved in Stripe, email failed" });
  }
  res.status(200).json({ ok: true });
}
