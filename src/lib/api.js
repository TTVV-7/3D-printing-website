// /api is proxied to the existing store backend (see vercel.json), so requests
// land in the same database and admin panel as before.
async function req(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const printRequests = {
  create: (entry) => req("/api/print-requests", { method: "POST", body: JSON.stringify(entry) }),
  // Fire-and-forget: the request is already saved, so a failed email is logged
  // server-side rather than surfaced to the customer.
  notify: (entry) =>
    fetch("/api/notify-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => {}),
};
