// POST /api/quote-confirm: emails the customer a confirmation of the quote
// request they just sent from the quote form (src/components/QuoteForm.jsx),
// with a picture of their model (rendered in the browser), their photos, and
// the link they gave.
//
// Anyone can call this, so it only ever sends this one fixed message, and only
// shows pictures stored in this site's own Blob store. The customer's link and
// words go in as plain text, never as clickable links or markup.
import { esc, layout, sendMail, EMAIL } from "./_mail.js";
import { originOf } from "./_sticker-order.js";

const FILE = /^\/api\/sticker-file\?p=requests%2F[\w-]{1,40}%2F[^&#?]{1,200}$/;
const IMAGE = /\.(png|jpe?g)$/i;
const text = (v, n) => String(v ?? "").trim().slice(0, n);

// The delivery chosen on the form (src/components/Delivery.jsx), in words.
function deliveryText(s) {
  if (!s || s.method !== "ship") return "Pickup in Vancouver";
  const postal = text(s.postal, 10);
  if (!(Number(s.price) > 0)) return `Shipping to ${postal || "you"}, price with the quote`;
  const by = s.by === "envelope" ? "Envelope, untracked" : "Tracked parcel";
  const [d0, d1] = Array.isArray(s.days) ? s.days.map((n) => Math.round(Number(n))) : [];
  const days = d0 >= 0 && d1 >= d0 && d1 < 60 ? ` (${d0}–${d1} business days in the mail)` : "";
  return `${by} to ${postal}, about $${Number(s.price).toFixed(2)}${days}`;
}

// A [low, high] dollar pair from the form, or null. Only ever numbers.
function range(v) {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [lo, hi] = v.map((n) => Math.round(Number(n)));
  return Number.isFinite(lo) && Number.isFinite(hi) && lo >= 0 && hi >= lo && hi < 1e6 ? [lo, hi] : null;
}
const money = ([lo, hi]) => (lo === hi ? `$${lo}` : `$${lo}–$${hi}`);

// One row per measured model: its picture, size and price range.
function partRow(f, ours) {
  const e = f.estimate || {};
  const price = range(e.price);
  const size = Array.isArray(e.sizeMm) && e.sizeMm.length === 3 && e.sizeMm.every((d) => Number.isFinite(Number(d)))
    ? e.sizeMm.map((d) => Math.round(Number(d))).join(" × ") + " mm"
    : "";
  const img = ours(f.previewUrl)
    ? `<img src="${esc(f.previewUrl)}" alt="" width="120" style="display:block;width:120px;height:90px;object-fit:cover;border-radius:10px;background:#f4f1ea">`
    : "";
  const detail = price
    ? `${size ? `<div style="color:#7a8494;font-size:13px">${esc(size)}</div>` : ""}<div style="font-size:16px;font-weight:700;margin-top:4px">${esc(money(price))}</div>`
    : `<div style="color:#7a8494;font-size:13px">I'll price this one by hand.</div>`;
  return `<tr><td style="padding:0 14px 12px 0;vertical-align:top;width:120px">${img}</td><td style="padding:0 0 12px;vertical-align:top;font-size:14px;word-break:break-all"><div style="font-weight:600">${esc(text(f.name, 120))}</div>${detail}</td></tr>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const o = req.body || {};
  const origin = originOf(req);
  const ours = (u) => typeof u === "string" && u.startsWith(origin) && FILE.test(u.slice(origin.length));

  const name = text(o.name, 100);
  const email = text(o.email, 200);
  if (!name || !EMAIL.test(email)) return res.status(400).json({ error: "Name and email needed" });

  const files = (Array.isArray(o.files) ? o.files : []).slice(0, 5).filter((f) => ours(f?.url));
  const photos = files.filter((f) => IMAGE.test(String(f.name)));
  const models = files.filter((f) => f.estimate && typeof f.estimate === "object");
  const others = files.filter((f) => !IMAGE.test(String(f.name)) && !models.includes(f));
  const total = range(o.estimate?.price);
  const minimum = Math.round(Number(o.estimate?.minimumOrder)) || 0;
  const thumb = ours(o.thumbnailUrl) ? o.thumbnailUrl : null;
  const link = /^https?:\/\/\S+$/i.test(text(o.url, 300)) ? text(o.url, 300) : "";
  const details = text(o.details, 600);
  const ref = text(o.id, 40).slice(0, 8).toUpperCase();

  // With per-part rows the model pictures are in those; the lone thumbnail
  // is for requests that came without them.
  const pictures = [
    ...(thumb && !models.length ? [{ src: thumb, alt: "Your model" }] : []),
    ...photos.map((f) => ({ src: f.url, alt: text(f.name, 120) })),
  ].slice(0, 4);
  const facts = [
    ["Material", text(o.material, 40) || "Your recommendation"],
    ["Quantity", String(Math.max(1, Math.min(10000, Number(o.quantity) || 1)))],
    ...(o.deadline ? [["Needed by", text(o.deadline, 20)]] : []),
    ["Delivery", deliveryText(o.shipping)],
    ...(link ? [["Link", link]] : []),
    ...(others.length ? [["Files", others.map((f) => text(f.name, 120)).join(", ")]] : []),
  ];

  const estimateHtml = models.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${models.map((f) => partRow(f, ours)).join("")}</table>
${total ? `<div style="margin:4px 0 12px;padding:14px 16px;background:#fff4ee;border-radius:12px">
<div style="font-size:13px;color:#7a8494">Rough total${o.estimate?.partial ? " for the files I could measure" : ""}</div>
<div style="font-size:24px;font-weight:700">${esc(money(total))}</div>
<div style="font-size:12px;color:#7a8494;margin-top:2px">Automatic estimate from your files, CAD before tax${minimum ? `; orders start at $${minimum}` : ""}. I'll confirm the final price when I reply.</div>
</div>` : ""}`
    : "";

  const body = `${estimateHtml}${pictures
    .map(
      (p) =>
        `<img src="${esc(p.src)}" alt="${esc(p.alt)}" width="512" style="display:block;width:100%;max-width:512px;height:auto;margin:0 0 12px;border-radius:14px;background:#f4f1ea">`,
    )
    .join("")}
${details ? `<p style="margin:0 0 16px;padding:12px 14px;background:#f4f1ea;border-radius:12px;font-size:14px;line-height:1.5;white-space:pre-wrap">${esc(details)}</p>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.45">
${facts.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#7a8494;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:4px 0;word-break:break-all">${esc(v)}</td></tr>`).join("")}
</table>
${ref ? `<p style="margin:16px 0 0;font-size:12px;color:#7a8494">Ref ${esc(ref)}</p>` : ""}`;

  const first = name.split(" ")[0];
  const intro = `Hi ${esc(first)}, thanks for your request. I'll reply within one business day with a quote and a realistic turnaround. Here's what you sent${total ? ", with a rough price" : ""}:`;
  const priceText = models.length
    ? `\n\n${models.map((f) => `${text(f.name, 120)}: ${range(f.estimate.price) ? money(range(f.estimate.price)) : "priced by hand"}`).join("\n")}${total ? `\nRough total: ${money(total)} (automatic estimate, I'll confirm the final price)` : ""}`
    : "";
  const sent = await sendMail({
    to: email,
    subject: "Your printyours quote request",
    html: layout({ heading: "Request received", intro, body }),
    text: `Hi ${first}, thanks for your request. I'll reply within one business day with a quote and a realistic turnaround.${priceText}\n\n${details}\n\n${facts.map(([k, v]) => `${k}: ${v}`).join("\n")}${ref ? `\n\nRef ${ref}` : ""}`,
  });
  res.status(200).json({ ok: true, sent });
}
