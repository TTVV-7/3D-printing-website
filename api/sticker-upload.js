// POST /api/sticker-upload { name, data }: stores one design's print file (a
// PNG data URL: a few kB for thermal, up to 3 MB for full colour) privately
// in this project's Vercel Blob store and returns a link to it through
// api/sticker-file.js, for the order email. The link carries the file's
// random suffix, so it can't be guessed.
//
// The upload happens here on the server, so it works with however the Blob
// store is connected: the newer connection (BLOB_STORE_ID, signed in through
// Vercel's OIDC) or a classic BLOB_READ_WRITE_TOKEN; @vercel/blob finds either.
// With no store connected this fails and orders still go through, their
// emails saying the print file wasn't uploaded.
import { put } from "@vercel/blob";

const NAME = /^[\w-]{1,60}$/;
// Full-colour print files run larger than thermal ones; base64 keeps this
// under Vercel's 4.5 MB request limit.
const MAX_BYTES = 3 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { name, data } = req.body || {};
  if (!NAME.test(name || "") || typeof data !== "string" || !data.startsWith("data:image/png;base64,")) {
    return res.status(400).json({ error: "Expected a PNG print file" });
  }
  const png = Buffer.from(data.slice(22), "base64");
  if (png.length > MAX_BYTES || png.subarray(1, 4).toString() !== "PNG") {
    return res.status(400).json({ error: "Expected a PNG print file" });
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    const blob = await put(`stickers/${id}/${name}.png`, png, {
      access: "private",
      contentType: "image/png",
      addRandomSuffix: true,
    });
    const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
    res.status(200).json({ url: `${origin}/api/sticker-file?p=${encodeURIComponent(blob.pathname)}` });
  } catch (err) {
    console.error("sticker upload:", err.message);
    res.status(502).json({ error: err.message });
  }
}
