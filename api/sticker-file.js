// GET /api/sticker-file?p=<path>: serves a file from the private Blob store:
// sticker print files (stickers/<id>/<name>-<suffix>.png, from
// api/sticker-upload.js) and quote attachments (requests/<id>/<file>, from
// api/quote-upload.js). These are the links in order emails and the admin
// panel; without the random suffix Blob adds to every name a file can't be
// found, so the links can't be guessed.
import { get } from "@vercel/blob";
import { QUOTE_EXTENSIONS } from "./quote-upload.js";

const STICKER = /^stickers\/[\w-]+\/[\w-]+\.png$/;
const QUOTE = /^requests\/[\w-]{1,40}\/[^/\\]{1,140}$/;
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".heic": "image/heic", ".pdf": "application/pdf" };
const extOf = (p) => p.slice(p.lastIndexOf(".")).toLowerCase();

export default async function handler(req, res) {
  const p = String(req.query?.p || "");
  const ext = extOf(p);
  if (!STICKER.test(p) && !(QUOTE.test(p) && QUOTE_EXTENSIONS.includes(ext))) return res.status(400).send("Not a file from this site");
  try {
    const file = await get(p, { access: "private" });
    if (!file) return res.status(404).send("Not found");
    const body = Buffer.from(await new Response(file.stream).arrayBuffer());
    const name = p.split("/").pop().replace(/[^\w.-]/g, "_");
    // Images and PDFs open in the browser; models and archives download.
    res.setHeader("Content-Type", TYPES[ext] || "application/octet-stream");
    res.setHeader("Content-Disposition", `${TYPES[ext] ? "inline" : "attachment"}; filename="${name}"`);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.status(200).send(body);
  } catch (err) {
    console.error("sticker file:", err.message);
    res.status(502).send("Could not load the file");
  }
}
