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
import { readOrder, originOf, cents } from "./_sticker-order.js";
import { stripe, stripeKey } from "./_stripe.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!stripeKey()) return res.status(503).json({ error: "Payments are not set up yet" });

  const origin = originOf(req);
  const order = readOrder(req.body, origin);
  if (order.error) return res.status(400).json({ error: order.error });
  const { items, delivery, name, email, address, shipping, count } = order;

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
