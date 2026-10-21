// Browser stand-in for @vercel/blob/client in the Cloudflare build (vite.config.js
// aliases it here when CF_BUILD is set). QuoteForm.jsx calls uploadPresigned()
// exactly as on Vercel; here the file is sent to the Worker's
// /api/quote-upload route, which stores it in R2 and answers with the stored
// path, the same { pathname } the real client returns.
export async function uploadPresigned(pathname, file, options = {}) {
  const endpoint = options.handleUploadUrl || "/api/quote-upload";
  const res = await fetch(`${endpoint}?p=${encodeURIComponent(pathname)}`, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Upload failed (HTTP ${res.status})`);
  return data;
}

export const upload = uploadPresigned;
