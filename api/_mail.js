// Customer emails (order and quote confirmations), sent through Resend's
// HTTP API. The leading underscore keeps Vercel from serving this file as a
// function of its own.
//
// Env (Vercel > Settings > Environment Variables):
//   RESEND_API_KEY  from resend.com, after verifying printyours.ca there
//   MAIL_FROM       optional, defaults to "printyours <orders@printyours.ca>"
// With no key the emails are skipped (and logged); orders still go through.
import { site } from "../site.config.js";

const FROM = () => process.env.MAIL_FROM || "printyours <orders@printyours.ca>";

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Thomas's signature, same as the Gmail one, at the foot of every customer
// email. The logo tile is public/email/signature-logo.png.
function signature() {
  const url = site.url || "https://printyours.ca";
  const link = "color:#0c1a2e;text-decoration:none";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;padding-top:20px;border-top:1px solid #eee9df;width:100%"><tr>
<td style="vertical-align:middle;width:160px;padding-right:16px"><a href="${esc(url)}"><img src="${esc(url)}/email/signature-logo.png" width="160" height="60" alt="printyours.ca" style="display:block;width:160px;height:60px;border:0"></a></td>
<td style="vertical-align:top;border-left:3px solid #f5a623;padding-left:14px;font-size:13px;line-height:1.5;color:#7a8494">
<div style="font-size:16px;font-weight:700;color:#0c1a2e">Thomas Verigin</div>
<div>Owner, <strong style="color:#0c1a2e">Print Yours</strong> · Custom 3D printing in Vancouver</div>
<div style="margin-top:6px;color:#c9ccd2"><a href="${esc(url)}" style="${link};font-weight:700">printyours.ca</a> &nbsp;|&nbsp; <a href="mailto:${esc(site.email)}" style="${link}">${esc(site.email)}</a> &nbsp;|&nbsp; <a href="tel:+17789845255" style="${link};white-space:nowrap">778-984-5255</a></div>
<div style="font-size:12px">Parts, prototypes &amp; small batches · Free quote in 1 business day · Local pickup</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:10px"><tr><td style="background:#f5a623;border-radius:6px"><a href="${esc(url)}/#quote" style="display:inline-block;padding:7px 12px;font-size:13px;font-weight:700;color:#0c1a2e;text-decoration:none">Get a free quote &rarr;</a></td></tr></table>
</td></tr></table>`;
}

const SIGNATURE_TEXT = `

--
Thomas Verigin
Owner, Print Yours · Custom 3D printing in Vancouver
printyours.ca | ${site.email} | 778-984-5255
Parts, prototypes & small batches · Free quote in 1 business day · Local pickup
Get a free quote: https://printyours.ca/#quote`;

// The shared look: logo bar, a white card, a footer with the reply address.
export function layout({ heading, intro, body }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0c1a2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 16px;font-weight:700;font-size:18px;letter-spacing:-0.01em">printyours<span style="color:#ff5b1f">.ca</span></td></tr>
<tr><td style="background:#ffffff;border-radius:20px;padding:28px 24px">
<h1 style="margin:0 0 8px;font-size:22px;line-height:1.25">${heading}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#4a5566">${intro}</p>
${body}
${signature()}
</td></tr>
<tr><td style="padding:16px 4px;font-size:12px;line-height:1.5;color:#7a8494">Questions? Just reply to this email${site.email ? ` or write to <a href="mailto:${esc(site.email)}" style="color:#7a8494">${esc(site.email)}</a>` : ""}.<br>printyours.ca · Vancouver</td></tr>
</table></td></tr></table></body></html>`;
}

// Sends one email. Never throws: a failed confirmation mustn't fail an order.
export async function sendMail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`mail skipped (no RESEND_API_KEY): "${subject}" to ${to}`);
    return false;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM(), to: [to], reply_to: site.email || undefined, subject, html, text: text && text + SIGNATURE_TEXT }),
    });
    if (!r.ok) throw new Error(`resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return true;
  } catch (err) {
    console.error("mail failed:", err.message);
    return false;
  }
}
