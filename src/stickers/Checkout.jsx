import { useEffect, useRef, useState } from "react";
import { X, Lock, CreditCard, ArrowRight } from "lucide-react";

// MOCKUP. The real flow: sign in (Supabase + Google, as in the generator app)
// or carry on as a guest, then POST the order to a serverless function that
// makes a Stripe Checkout Session and redirects to Stripe's hosted page.
// Nothing here talks to Supabase or Stripe yet.

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function Checkout({ order, onClose }) {
  const [step, setStep] = useState("account"); // account -> pay -> done
  const [who, setWho] = useState(null);
  const thumb = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const c = thumb.current;
    if (!c || !order.art) return;
    c.width = order.art.width;
    c.height = order.art.height;
    c.getContext("2d").drawImage(order.art, 0, 0);
  }, [order.art, step]);

  const shipping = 3.5;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Check out"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-2xl sm:rounded-3xl"
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 hover:bg-ink/5" aria-label="Close">
          <X size={18} />
        </button>
        <p className="font-mono text-[10px] uppercase tracking-widest text-flame">Preview · no real payment</p>

        <div className="mt-4 flex items-center gap-4 rounded-2xl bg-white p-3 ring-1 ring-ink/10">
          <div className="flex h-16 w-16 flex-none items-center justify-center rounded-xl bg-paper-dark">
            <canvas ref={thumb} className="max-h-14 max-w-14" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">
              {order.qty} × {order.paper.name.toLowerCase()} {order.finish} sticker{order.qty > 1 ? "s" : ""}
            </p>
            <p className="text-ink/55">
              {order.size.w} × {order.size.h} mm · {order.shape === "rect" ? "rectangle" : order.shape}
            </p>
          </div>
          <p className="font-display font-semibold">${order.total.toFixed(2)}</p>
        </div>

        {step === "account" && (
          <div className="mt-6">
            <h2 className="text-2xl font-bold">How do you want to check out?</h2>
            <p className="mt-1 text-sm text-ink/60">Sign in to keep your designs and reorder in one tap.</p>
            <button
              type="button"
              onClick={() => {
                setWho({ name: "Signed-in customer", email: "you@gmail.com" });
                setStep("pay");
              }}
              className="btn mt-5 w-full bg-white text-ink ring-1 ring-ink/15 hover:bg-ink/5"
            >
              <GoogleMark /> Continue with Google
            </button>
            <div className="my-4 flex items-center gap-3 text-xs text-ink/40">
              <span className="h-px flex-1 bg-ink/10" /> or <span className="h-px flex-1 bg-ink/10" />
            </div>
            <button
              type="button"
              onClick={() => {
                setWho(null);
                setStep("pay");
              }}
              className="btn-outline-dark w-full"
            >
              Check out as a guest
            </button>
          </div>
        )}

        {step === "pay" && (
          <div className="mt-6">
            <h2 className="text-2xl font-bold">Order summary</h2>
            {who && <p className="mt-1 text-sm text-ink/60">Signed in as {who.email}</p>}
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink/60">Stickers ({order.qty} × ${order.each.toFixed(2)})</dt>
                <dd>${order.total.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/60">Shipping (lettermail) or free Vancouver pickup</dt>
                <dd>${shipping.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink/10 pt-2 font-semibold">
                <dt>Total before tax</dt>
                <dd>${(order.total + shipping).toFixed(2)}</dd>
              </div>
            </dl>
            <button type="button" onClick={() => setStep("done")} className="btn mt-6 w-full bg-[#635bff] text-white hover:bg-[#5249e0]">
              <Lock size={16} /> Pay with Stripe <ArrowRight size={16} />
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink/50">
              <CreditCard size={14} /> Card, Apple Pay and Google Pay on Stripe's secure page
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="mt-6 text-center">
            <h2 className="text-2xl font-bold">This is where Stripe takes over.</h2>
            <p className="mt-2 text-sm text-ink/60">
              In the live version this button sends you to Stripe's checkout page. After paying
              you land back here on a thank-you page, and the order (with the print-ready image)
              shows up in the admin panel.
            </p>
            <button type="button" onClick={onClose} className="btn-primary mt-6">
              Back to my sticker
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
