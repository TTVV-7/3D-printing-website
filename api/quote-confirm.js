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
  const others = files.filter((f) => !IMAGE.test(String(f.name)));
  const thumb = ours(o.thumbnailUrl) ? o.thumbnailUrl : null;
  const link = /^https?:\/\/\S+$/i.test(text(o.url, 300)) ? text(o.url, 300) : "";
  const details = text(o.details, 600);
  const ref = text(o.id, 40).slice(0, 8).toUpperCase();

  const pictures = [
    ...(thumb ? [{ src: thumb, alt: "Your model" }] : []),
    ...photos.map((f) => ({ src: f.url, alt: text(f.name, 120) })),
  ].slice(0, 4);
  const facts = [
    ["Material", text(o.material, 40) || "Your recommendation"],
    ["Quantity", String(Math.max(1, Math.min(10000, Number(o.quantity) || 1)))],
    ...(o.deadline ? [["Needed by", text(o.deadline, 20)]] : []),
    ...(link ? [["Link", link]] : []),
    ...(others.length ? [["Files", others.map((f) => text(f.name, 120)).join(", ")]] : []),
  ];

  const body = `${pictures
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
  const intro = `Hi ${esc(first)}, thanks for your request. I'll reply within one business day with a quote and a realistic turnaround. Here's what you sent:`;
  const sent = await sendMail({
    to: email,
    subject: "Your printyours quote request",
    html: layout({ heading: "Request received", intro, body }),
    text: `Hi ${first}, thanks for your request. I'll reply within one business day with a quote and a realistic turnaround.\n\n${details}\n\n${facts.map(([k, v]) => `${k}: ${v}`).join("\n")}${ref ? `\n\nRef ${ref}` : ""}`,
  });
  res.status(200).json({ ok: true, sent });
}
