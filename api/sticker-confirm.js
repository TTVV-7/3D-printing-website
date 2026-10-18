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

  // One line per design in the cart: item1, item2, ... (api/sticker-checkout.js).
  const items = Object.keys(m)
    .filter((k) => /^item\d+$/.test(k))
    .sort((a, b) => a.slice(4) - b.slice(4))
    .map((k) => m[k]);
  const imageOf = (note) => note.match(/print file: (https:\S+)/)?.[1];
  const qtyOf = (note) => Number(note.match(/^(\d+) x/)?.[1]) || 0;
  // Opens the design in the in-shop Sticker Printer app (TTVV-7/Stickers,
  // running on this computer at port 8420) on the right label and copies.
  const appLink = (note) => {
    const file = imageOf(note);
    const code = note.match(/printer size (w\d+h\d+)/)?.[1];
    if (!file || !code) return null;
    return `http://127.0.0.1:8420/?import=${encodeURIComponent(file)}&size=${code}&copies=${Math.min(50, qtyOf(note))}`;
  };
  const count = items.reduce((n, note) => n + qtyOf(note), 0);

  const details = [
    `PAID STICKER ORDER${live ? "" : " (Stripe TEST mode, no real money)"}`,
    `Card held, not charged yet: capture it in Stripe once printed, or cancel the hold.`,
    `${dashboard}`,
    ``,
    `To print: with the Sticker Printer app running, click "open in Sticker Printer" under each design.`,
    `It opens on the right label size and copies; check it, then Print. (The app prints up to 50 copies at a time.)`,
    ``,
    `${items.length} design${items.length > 1 ? "s" : ""}, ${count} stickers:`,
    ...items.flatMap((note, i) => [
      ``,
      `${i + 1}. ${note.split(" | ").join("\n   ")}`,
      ...(appLink(note) ? [`   open in Sticker Printer: ${appLink(note)}`] : []),
    ]),
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
    quantity: count || 1,
    deadline: null,
    budget: `Paid ${money(session.amount_total)} (held)`,
    files: items
      .map((note, i) => imageOf(note) && { name: `sticker-${i + 1}.png`, size: 0, url: imageOf(note) })
      .filter(Boolean),
    title: `Sticker order (paid): ${count} stickers, ${items.length} design${items.length > 1 ? "s" : ""}`,
    stlName: null,
    thumbnailUrl: imageOf(items[0] || "") || null,
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
