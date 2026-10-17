import { useEffect, useRef, useState } from "react";
import { X, Lock, CreditCard, ArrowRight, Loader2 } from "lucide-react";
import { stickers } from "../../site.config.js";

// Sends the order to api/sticker-checkout.js, which hands back a Stripe
// Checkout page to go to. Until STRIPE_SECRET_KEY is set there (or in
// `npm run dev`, where /api goes to the store backend) it can't, and this
// says so instead.

export function Checkout({ order, onClose }) {
  const [step, setStep] = useState("pay"); // pay -> (Stripe) | preview
  const [busy, setBusy] = useState(false);
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

  const shipping = stickers.shipping[0].amount;

  async function pay() {
    setBusy(true);
    try {
      const r = await fetch("/api/sticker-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          w: order.size.w,
          h: order.size.h,
          shape: order.shape,
          paper: order.paper.key,
          finish: order.finish,
          qty: order.qty,
          art: order.art?.toDataURL("image/png"),
        }),
      });
      const { url } = r.ok ? await r.json() : {};
      if (url) return window.location.assign(url);
    } catch {
      // Fall through to the not-set-up message.
    }
    setBusy(false);
    setStep("preview");
  }

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
        <p className="font-mono text-[10px] uppercase tracking-widest text-flame">Check out</p>

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

        {step === "pay" && (
          <div className="mt-6">
            <h2 className="text-2xl font-bold">Order summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink/60">Stickers ({order.qty} × ${order.each.toFixed(2)})</dt>
                <dd>${order.total.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/60">Shipping (or free Vancouver pickup)</dt>
                <dd>${shipping.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink/10 pt-2 font-semibold">
                <dt>Total before tax</dt>
                <dd>${(order.total + shipping).toFixed(2)}</dd>
              </div>
            </dl>
            <button type="button" onClick={pay} disabled={busy} className="btn mt-6 w-full bg-[#635bff] text-white hover:bg-[#5249e0] disabled:opacity-70">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Pay with Stripe <ArrowRight size={16} />
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink/50">
              <CreditCard size={14} /> Card, Apple Pay and Google Pay on Stripe's secure page
            </p>
            <p className="mt-1 text-center text-xs text-ink/50">
              Your card is held, and only charged once your stickers are printed.
            </p>
          </div>
        )}

        {step === "preview" && (
          <div className="mt-6 text-center">
            <h2 className="text-2xl font-bold">Payments aren't switched on yet.</h2>
            <p className="mt-2 text-sm text-ink/60">
              Once a Stripe key is added, this button goes to Stripe's checkout page and you land
              back here after paying.
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
