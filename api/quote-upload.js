// POST /api/quote-upload: lets the quote form upload attachments (STL, 3MF,
// photos, PDFs... up to 25 MB, see FileDrop.jsx) straight from the browser
// to this project's private Blob store. Replaces the store backend's
// /api/upload, which has no Blob store connected.
//
// The Blob store is connected through Vercel OIDC (BLOB_STORE_ID), which has
// no read-write token to sign browser uploads with, so this issues a
// short-lived presigned URL for exactly one requests/<id>/<file> path.
// Files are private; api/sticker-file.js serves them by link.
import { handleUploadPresigned } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";

// Logos come as .svg, .ai or .eps too; api/sticker-file.js serves those as downloads.
export const QUOTE_EXTENSIONS = [".stl", ".3mf", ".obj", ".step", ".stp", ".gcode", ".zip", ".jpg", ".jpeg", ".png", ".heic", ".pdf", ".svg", ".ai", ".eps"];
const MAX_BYTES = 25 * 1024 * 1024;
const PATH = /^requests\/[\w-]{1,40}\/[^/\\]{1,120}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const out = await handleUploadPresigned({
      body: req.body,
      request: req,
      getSignedToken: async (pathname) => {
        const ext = pathname.slice(pathname.lastIndexOf(".")).toLowerCase();
        if (!PATH.test(pathname) || !QUOTE_EXTENSIONS.includes(ext)) throw new Error("Not a quote attachment");
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          maximumSizeInBytes: MAX_BYTES,
          validUntil: Date.now() + 15 * 60 * 1000,
        });
        return { token, urlOptions: { addRandomSuffix: true, maximumSizeInBytes: MAX_BYTES } };
      },
    });
    res.status(200).json(out);
  } catch (err) {
    console.error("quote upload:", err.message);
    res.status(400).json({ error: err.message });
  }
}
