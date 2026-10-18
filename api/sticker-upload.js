// POST /api/sticker-upload: lets the sticker page upload each design's print
// file straight to this project's Vercel Blob store (the page calls it
// through @vercel/blob/client's upload()). Only small PNGs under stickers/.
//
// Needs a Blob store connected to this project (Vercel > Storage > Blob),
// which adds BLOB_READ_WRITE_TOKEN. Without it this answers 503 and orders
// still go through, their emails saying the print file wasn't uploaded.
import { handleUpload } from "@vercel/blob/client";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: "File storage is not set up yet" });
  try {
    const out = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^stickers\/[\w-]+\/[\w.-]+\.png$/.test(pathname)) throw new Error("Not a sticker print file");
        return { allowedContentTypes: ["image/png"], maximumSizeInBytes: 2 * 1024 * 1024, addRandomSuffix: true };
      },
    });
    res.status(200).json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
