// POST /api/sticker-request: a friends-and-family sticker request from
// /stickers. Same cart, details and checks as api/sticker-checkout.js, but no
// payment: it goes straight to the store backend's admin panel and order
// email, marked as a request, with what it would have cost.
import { readOrder, fileOrder, originOf, short, money, cents, confirmationEmail } from "./_sticker-order.js";
import { sendMail } from "./_mail.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const order = readOrder(req.body, originOf(req));
  if (order.error) return res.status(400).json({ error: order.error });
  const { items, delivery, name, email, address, subtotal, shipping } = order;
  const message = short(req.body?.message, 1000);
  const worth = cents(subtotal + shipping);

  try {
    await fileOrder({
      id: `sticker-request-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title: "Sticker request (friends & family)",
      heading: [`FRIENDS & FAMILY STICKER REQUEST: no payment taken.`],
      notes: items.map((it) => it.note),
      delivery,
      shipTo: address && { name, address },
      name,
      email,
      footer: [
        ...(message ? [`Message: ${message}`, ``] : []),
        `Would have cost: ${money(worth)} CAD before tax (not charged)`,
      ],
      budget: "Friends & family (no payment)",
      total: 0,
    });
  } catch (err) {
    console.error("sticker request not filed:", err.message);
    return res.status(502).json({ error: "Could not send the request" });
  }
  await sendMail({
    to: email,
    ...confirmationEmail({ paid: false, name, items: items.map((it) => ({ note: it.note, preview: it.preview })), delivery }),
  });
  res.status(200).json({ ok: true });
}
