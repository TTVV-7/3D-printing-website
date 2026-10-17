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
import { stripe, stripeKey, STORE_API } from "./_stripe.js";

const money = (cents) => `$${(cents / 100).toFixed(2)}`;

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
  const ship = pi.shipping;
  const addr = ship?.address;
  const delivery = deliveryOf(m.delivery);
  const live = id.startsWith("cs_live_");
  const dashboard = `https://dashboard.stripe.com/${live ? "" : "test/"}payments/${pi.id}`;

  const details = [
    `PAID STICKER ORDER${live ? "" : " (Stripe TEST mode, no real money)"}`,
    `Card held, not charged yet: capture it in Stripe once printed, or cancel the hold.`,
    `${dashboard}`,
    ``,
    `Quantity: ${m.qty}`,
    `Size: ${m.size}`,
    `Shape: ${m.shape}`,
    `Label: ${m.label}`,
    `Ink: ${m.ink}`,
    `Customer's file: ${m.file || "(sample image)"}`,
    `Print-ready image: ${m.art || "(not uploaded -- rebuild from the settings above)"}`,
    ``,
    `Delivery: ${delivery?.name || m.delivery}`,
    ...(addr
      ? [`Ship to: ${ship.name}`, addr.line1, addr.line2, `${addr.city}, ${addr.state} ${addr.postal_code}`].filter(Boolean)
      : []),
    `Phone: ${c.phone || "-"}`,
    ``,
    `Customer: ${m.name} <${c.email || session.customer_email}>`,
    ``,
    `Total held: ${money(session.amount_total)} CAD`,
  ].join("\n");

  // Same shape the quote form sends (src/components/QuoteForm.jsx).
  const entry = {
    id: `sticker-${pi.id}`,
    mode: "description",
    name: m.name || c.name || "Sticker customer",
    email: session.customer_email || c.email || "",
    details,
    url: null,
    material: "Sticker",
    quality: null,
    quantity: Number(m.qty) || 1,
    deadline: null,
    budget: `Paid ${money(session.amount_total)} (held)`,
    files: m.art ? [{ name: "sticker.png", size: 0, url: m.art }] : [],
    title: `Sticker order (paid): ${m.qty} × ${m.size}, ${m.label}`,
    stlName: null,
    thumbnailUrl: m.art || null,
    weightG: null,
    printTimeHrs: null,
    filamentCost: null,
    timeCost: null,
    totalCost: session.amount_total / 100,
    submittedAt: new Date().toISOString(),
  };

  try {
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
    await s.paymentIntents.update(pi.id, { metadata: { notified: new Date().toISOString() } });
  } catch (err) {
    // The order is safe in Stripe either way; this only loses the email.
    console.error("sticker order not filed:", err.message);
    return res.status(502).json({ error: "Order saved in Stripe, email failed" });
  }
  res.status(200).json({ ok: true });
}
