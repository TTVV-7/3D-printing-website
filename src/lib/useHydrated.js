import { useEffect, useState } from "react";

// False on the first render, true straight after. Things only the browser can
// draw (canvas previews) wait for it, so the first render matches the page's
// prerendered HTML (scripts/prerender.js) and hydration has nothing to fix.
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
