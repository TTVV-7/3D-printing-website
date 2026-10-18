// GET /api/sticker-file?p=stickers/<id>/<name>-<suffix>.png: shows a sticker
// print file from the private Blob store. These are the links in order emails
// (api/sticker-upload.js makes them); without the random suffix in the name a
// file can't be found, so the links can't be guessed.
import { get } from "@vercel/blob";

const PATH = /^stickers\/[\w-]+\/[\w-]+\.png$/;

export default async function handler(req, res) {
  const p = String(req.query?.p || "");
  if (!PATH.test(p)) return res.status(400).send("Not a sticker print file");
  try {
    const file = await get(p, { access: "private" });
    if (!file) return res.status(404).send("Not found");
    const png = Buffer.from(await new Response(file.stream).arrayBuffer());
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `inline; filename="${p.split("/").pop()}"`);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.status(200).send(png);
  } catch (err) {
    console.error("sticker file:", err.message);
    res.status(502).send("Could not load the file");
  }
}
