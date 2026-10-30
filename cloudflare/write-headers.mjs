// Writes dist/_headers for the Cloudflare build: the same cache rules
// vercel.json sets, in the format Cloudflare's static assets read. Written
// into dist only, so the Vercel build never sees it.
import { writeFile } from "node:fs/promises";

await writeFile(
  new URL("../dist/_headers", import.meta.url),
  [
    "/work/*",
    "  Cache-Control: public, max-age=604800",
    "",
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n"),
);
console.log("wrote dist/_headers");
