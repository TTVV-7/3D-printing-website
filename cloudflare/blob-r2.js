// Stands in for @vercel/blob (and @vercel/blob/client) when the api/ functions
// are bundled for Cloudflare: wrangler.jsonc aliases both packages here, so
// sticker-upload.js and sticker-file.js store and read files in the R2 bucket
// bound as UPLOADS instead of Vercel Blob, without a line of them changing.
//
// Only what api/ actually calls is implemented: put() and get(). Quote
// attachments use their own route on Cloudflare (cloudflare/quote-upload.js),
// so the presigned-upload helpers below just refuse.

function bucket() {
  const b = globalThis.__PRINTYOURS_R2;
  if (!b) throw new Error("No R2 bucket bound as UPLOADS (see wrangler.jsonc)");
  return b;
}

// Vercel Blob adds a random suffix before the extension so links can't be
// guessed; keep the same shape so the path checks in api/ still match.
export function withRandomSuffix(pathname) {
  const slash = pathname.lastIndexOf("/");
  const dot = pathname.lastIndexOf(".");
  const cut = dot > slash ? dot : pathname.length;
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 21);
  return `${pathname.slice(0, cut)}-${rand}${pathname.slice(cut)}`;
}

export async function put(pathname, body, options = {}) {
  const key = options.addRandomSuffix ? withRandomSuffix(pathname) : pathname;
  await bucket().put(key, body, {
    httpMetadata: options.contentType ? { contentType: options.contentType } : undefined,
  });
  return { pathname: key, url: key, downloadUrl: key, contentType: options.contentType };
}

export async function get(pathname) {
  const obj = await bucket().get(pathname);
  if (!obj) return null;
  return {
    stream: obj.body,
    blob: { pathname, contentType: obj.httpMetadata?.contentType, size: obj.size },
  };
}

const notHere = (name) => () => {
  throw new Error(`${name} is not used on Cloudflare; see cloudflare/quote-upload.js`);
};
export const issueSignedToken = notHere("issueSignedToken");
export const handleUploadPresigned = notHere("handleUploadPresigned");
export const handleUpload = notHere("handleUpload");
