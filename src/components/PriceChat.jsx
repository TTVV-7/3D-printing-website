import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, MessageCircle, Send, X } from "lucide-react";
import { clsx } from "clsx";
import { track } from "@vercel/analytics";

// "Ask about a price": a chat bubble, bottom right, on every page. Answers
// come from /api/price-chat (cloudflare/price-chat.js), which knows the
// prices in site.config.js and works out part estimates with the quote
// form's own formula. An estimate can go straight into the quote form,
// filled in (QuoteForm.jsx reads it from sessionStorage).
//
// Only in the Cloudflare build (VITE_PRICE_CHAT=1, set by `npm run build:cf`),
// where the chat route exists. The Vercel build never shows it.
export const PRICE_CHAT = import.meta.env.VITE_PRICE_CHAT === "1";

const STARTERS = ["How much for a small bracket?", "What do stickers cost?", "Which material for outdoors?", "Do you ship?"];
const GREETING = {
  role: "assistant",
  content: "Hi! Tell me what you'd like printed, roughly how big it is and how many, and I'll give you a ballpark price. Or ask about stickers, materials or delivery.",
};
const STORE = "price-chat";

function EstimateCard({ e }) {
  function toQuote() {
    track("Price estimate to quote", { material: e.material, quantity: e.quantity });
    const details = `${e.name}: about ${e.sizeMm.join(" × ")} mm, ${e.build === "thin" ? "thin-walled" : e.build}, ${e.quantity} ${e.quantity > 1 ? "copies" : "copy"}. Price helper estimate $${e.low}–$${e.high}.`;
    try {
      sessionStorage.setItem("quote-prefill", JSON.stringify({ details, material: e.material, quantity: String(e.quantity) }));
    } catch {
      // No storage: the quote form just opens empty.
    }
    if (location.pathname === "/") {
      window.dispatchEvent(new Event("quote:prefill"));
      document.getElementById("quote")?.scrollIntoView({ behavior: "smooth" });
    } else {
      location.href = "/#quote";
    }
  }
  return (
    <div className="mt-2 rounded-xl bg-paper p-3 ring-1 ring-ink/10">
      <p className="text-xs text-ink/55">
        {e.name} · {e.sizeMm.join(" × ")} mm · {e.material} · ×{e.quantity}
      </p>
      <p className="mt-0.5 font-display text-xl font-bold">
        ${e.low}–${e.high}
      </p>
      <p className="text-xs text-ink/55">
        {e.tooBig ? "Bigger than the print bed, so it would be printed in parts. " : ""}A ballpark from the description; the free quote gives a fixed price.
      </p>
      <button type="button" onClick={toQuote} className="btn-primary mt-2 h-9 w-full px-3 text-sm">
        Send this as a quote request <ArrowRight size={14} />
      </button>
    </div>
  );
}

export function PriceChat() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  // Client only (the home page is prerendered), and the conversation
  // survives moving between pages.
  useEffect(() => {
    setMounted(true);
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE));
      if (Array.isArray(saved) && saved.length) setMessages(saved);
    } catch {
      // Nothing saved.
    }
  }, []);
  useEffect(() => {
    if (!mounted) return;
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-20)));
    } catch {
      // Storage full or blocked: it just won't carry over.
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mounted, open]);

  async function send(text) {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/price-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The greeting is ours, not the model's: leave it out.
        body: JSON.stringify({ messages: next.filter((m) => m !== GREETING).map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) throw new Error(data.error || "The price helper couldn't answer just now.");
      setMessages((m) => [...m, { role: "assistant", content: data.reply, estimate: data.estimate || undefined }]);
      track("Price chat", { turn: next.filter((m) => m.role === "user").length, estimate: Boolean(data.estimate) });
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  if (!PRICE_CHAT || !mounted) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[55] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div
          role="dialog"
          aria-label="Ask about a price"
          className="flex h-[min(34rem,calc(100vh-7rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-ink/10"
        >
          <div className="flex items-center justify-between bg-ink px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Ask about a price</p>
              <p className="text-xs text-white/60">Ballpark prices, materials, stickers, delivery</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1.5 hover:bg-white/10">
              <X size={18} />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={clsx(
                    "max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm",
                    m.role === "user" ? "bg-ink text-white" : "bg-paper text-ink",
                  )}
                >
                  {m.content}
                  {m.estimate && <EstimateCard e={m.estimate} />}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-ink/50">
                <Loader2 size={14} className="animate-spin" /> Thinking…
              </div>
            )}
            {messages.length === 1 && !busy && (
              <div className="flex flex-wrap gap-1.5">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium ring-1 ring-ink/15 hover:ring-ink/40">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {error && <p className="rounded-xl bg-flame-100 px-3 py-2 text-sm text-flame-600">{error}</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-ink/10 p-3"
          >
            <input
              className="field h-10 flex-1 text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. a hook about 5 cm long, 10 of them"
              maxLength={600}
              aria-label="Your question"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="btn-primary h-10 w-10 flex-none p-0 disabled:opacity-50">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-12 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white shadow-xl ring-1 ring-white/10 transition hover:bg-ink/90"
      >
        {open ? <X size={18} /> : <MessageCircle size={18} />} {open ? "Close" : "Ask about a price"}
      </button>
    </div>
  );
}
