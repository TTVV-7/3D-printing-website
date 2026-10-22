import { useEffect, useRef, useState } from "react";

// Cloudflare Turnstile: proves a visitor isn't a bot before the site sends
// emails, stores files or files a request. Only in the Cloudflare build, where
// `npm run build:cf` sets VITE_TURNSTILE_SITE_KEY and the Worker checks it
// (cloudflare/turnstile.js). Most visitors never see it; it only shows a
// checkbox when Cloudflare isn't sure.
//
// A form renders the widget with useTurnstile() and sends the token as an
// X-Turnstile header (turnstileHeaders()) on each request it makes.
export const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

// The latest token from any widget on the page, for turnstileHeaders(), and
// anyone waiting for one (waitForToken).
let current = "";
let waiting = [];

// The token, waiting up to `ms` for the check to finish; "" if it didn't (the
// visitor needs to tick the box, which shows itself when that's the case).
export function waitForToken(ms = 6000) {
  if (current || !TURNSTILE_KEY) return Promise.resolve(current);
  return new Promise((resolve) => {
    const done = (t) => {
      clearTimeout(timer);
      waiting = waiting.filter((w) => w !== done);
      resolve(t);
    };
    const timer = setTimeout(() => done(""), ms);
    waiting.push(done);
  });
}
export const NOT_VERIFIED = "Please tick \u201cVerify you are human\u201d just above the button, then send again.";

export const turnstileHeaders = () => (current ? { "X-Turnstile": current } : {});

export function useTurnstile() {
  const box = useRef(null);
  const widget = useRef(null);
  const [token, setTokenState] = useState("");
  const setToken = (t) => {
    current = t;
    setTokenState(t);
    if (t) waiting.forEach((w) => w(t));
  };

  useEffect(() => {
    if (!TURNSTILE_KEY) return;
    const render = () => {
      if (!box.current || widget.current !== null || !window.turnstile) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_KEY,
        size: "flexible",
        appearance: "interaction-only",
        callback: setToken,
        "expired-callback": () => setToken(""),
      });
    };
    let wait;
    if (window.turnstile) render();
    else if (!document.querySelector("script[data-turnstile]")) {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.dataset.turnstile = "1";
      s.onload = render;
      document.head.appendChild(s);
    }
    // Another widget on the page is still loading the script.
    if (!window.turnstile) wait = setInterval(() => window.turnstile && (clearInterval(wait), render()), 200);
    return () => {
      clearInterval(wait);
      if (widget.current !== null) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  // A fresh token for the next submission.
  const reset = () => {
    setToken("");
    if (widget.current !== null) window.turnstile?.reset(widget.current);
  };
  return { box, token, reset, needed: Boolean(TURNSTILE_KEY), wait: waitForToken };
}
