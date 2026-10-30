// PUT /api/quote-upload?p=requests/<id>/<file> on Cloudflare: the quote form's
// attachments (STL, 3MF, photos, PDFs... up to 25 MB) go through this Worker
// into the R2 bucket bound as UPLOADS.
//
// On Vercel the browser uploads straight to Blob with a presigned token
// (api/quote-upload.js). R2 has no egress or request-size billing to dodge,
// so here the file simply streams through the Worker instead; the Cloudflare
// build swaps the browser side to match (cloudflare/client/blob-upload.js).
// Same path rules and size limit as the Vercel route, and the stored file is
// served back the same way, through /api/sticker-file?p=<path>.
import { QUOTE_EXTENSIONS } from "../api/quote-upload.js";
import { withRandomSuffix } from "./blob-r2.js";

const MAX_BYTES = 25 * 1024 * 1024;
const PATH = /^requests\/[\w-]{1,40}\/[^/\\]{1,120}$/;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export default async function quoteUpload(request, env) {
  if (request.method !== "PUT") return json({ error: "PUT only" }, 405);
  const pathname = new URL(request.url).searchParams.get("p") || "";
  const ext = pathname.slice(pathname.lastIndexOf(".")).toLowerCase();
  if (!PATH.test(pathname) || !QUOTE_EXTENSIONS.includes(ext)) return json({ error: "Not a quote attachment" }, 400);

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) return json({ error: "File is over 25 MB" }, 413);
  const data = await request.arrayBuffer();
  if (!data.byteLength) return json({ error: "Empty file" }, 400);
  if (data.byteLength > MAX_BYTES) return json({ error: "File is over 25 MB" }, 413);

  const key = withRandomSuffix(pathname);
  try {
    await env.UPLOADS.put(key, data, {
      httpMetadata: { contentType: request.headers.get("content-type") || "application/octet-stream" },
    });
  } catch (err) {
    console.error("quote upload:", err.message);
    return json({ error: "Could not store the file" }, 502);
  }
  return json({ pathname: key });
}
