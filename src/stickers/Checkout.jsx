import { useEffect, useState } from "react";
import { X, Lock, CreditCard, ArrowRight, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { stickers } from "../../site.config.js";
import { deliveryCost, sizeOf, lineTotal, itemLabel } from "./pricing.js";

// Uploads each cart line's print-ready image (through the store backend's
// /api/upload, same as quote attachments), then sends the cart to
// api/sticker-checkout.js,
// which hands back a Stripe Checkout page to go to. Until a Stripe key is set
// there (or in `npm run dev`, where /api goes to the store backend) it can't,
// and this says so instead.

async function uploadArt(dataUrl, name) {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const { upload } = await import("@vercel/blob/client");
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const res = await upload(`requests/sticker-${id}/${name}.png`, blob, {
      access: "public",
      handleUploadUrl: "/api/upload",
    });
    return res.url;
  } catch (err) {
    // The order still has every setting; the image can be rebuilt from them.
    console.warn("sticker image not uploaded:", err);
    return "";
  }
}

const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const POSTAL = /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({ label, className, ...props }) {
  return (
    <label className={clsx("block text-sm", className)}>
      <span className="mb-1 block font-medium text-ink/70">{label}</span>
      {props.children || <input className="field" {...props} />}
    </label>
  );
}

export function Checkout({ items, onRemove, onClose }) {
  const [step, setStep] = useState("pay"); // pay -> (Stripe) | preview
  const [busy, setBusy] = useState(false);
  const [delivery, setDelivery] = useState(stickers.delivery[0]);
  const [who, setWho] = useState({ name: "", email: "", line1: "", line2: "", city: "", province: "BC", postal: "" });
  const [error, setError] = useState("");
  const set = (k) => (e) => setWho((w) => ({ ...w, [k]: e.target.value }));
  const mailed = delivery.key !== "pickup";

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const subtotal = items.reduce((sum, it) => sum + lineTotal(it), 0);
  const shipping = deliveryCost(delivery, subtotal);

  // Emptied the cart from in here: nothing left to pay for.
  useEffect(() => {
    if (!items.length) onClose();
  }, [items.length, onClose]);

  function problem() {
    if (!who.name.trim()) return "Add your name.";
    if (!EMAIL.test(who.email.trim())) return "Add an email address so you get the receipt.";
    if (mailed && (!who.line1.trim() || !who.city.trim())) return "Add the street address and city.";
    if (mailed && !POSTAL.test(who.postal.trim())) return "That postal code doesn't look right (e.g. V5K 0A1).";
    return "";
  }

  async function pay(e) {
    e.preventDefault();
    const p = problem();
    setError(p);
    if (p) return;
    setBusy(true);
    try {
      // The black-on-white print file; carts saved before it existed send the preview.
      const arts = await Promise.all(
        items.map((it, i) => uploadArt(it.print || it.art, `${i + 1}-${sizeOf(it.sizeKey).code}-x${it.qty}`)),
      );
      const r = await fetch("/api/sticker-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it, i) => ({
            size: it.sizeKey,
            ring: it.ring,
            finish: it.finishKey,
            colour: it.colourKey,
            qty: it.qty,
            ink: it.ink,
            file: it.fileName,
            art: arts[i],
          })),
          customer: {
            name: who.name.trim(),
            email: who.email.trim(),
            ...(mailed && {
              address: {
                line1: who.line1.trim(),
                line2: who.line2.trim(),
                city: who.city.trim(),
                state: who.province,
                postal_code: who.postal.trim().toUpperCase(),
              },
            }),
          },
          delivery: delivery.key,
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

        <ul className="mt-4 divide-y divide-ink/10 rounded-2xl bg-white px-3 ring-1 ring-ink/10">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-2.5">
              <img src={it.art} alt="" className="h-14 w-14 flex-none rounded-xl bg-paper-dark object-contain p-1 [image-rendering:pixelated]" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">
                  {it.qty} × {sizeOf(it.sizeKey).name} sticker{it.qty > 1 ? "s" : ""}
                </p>
                <p className="truncate text-ink/55">{itemLabel(it)}</p>
              </div>
              <p className="font-display font-semibold">${lineTotal(it).toFixed(2)}</p>
              {step === "pay" && (
                <button
                  type="button"
                  onClick={() => onRemove(it.id)}
                  aria-label="Remove from cart"
                  className="rounded-lg p-1.5 text-ink/50 hover:bg-flame hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>

        {step === "pay" && (
          <form className="mt-6" onSubmit={pay} noValidate>
            <h2 className="text-xl font-bold">Delivery</h2>
            <div className="mt-3 space-y-2" role="radiogroup" aria-label="Delivery">
              {stickers.delivery.map((d) => {
                const cost = deliveryCost(d, subtotal);
                return (
                  <button
                    key={d.key}
                    type="button"
                    role="radio"
                    aria-checked={delivery.key === d.key}
                    onClick={() => setDelivery(d)}
                    className={clsx(
                      "flex w-full items-start justify-between gap-3 rounded-xl bg-white p-3 text-left ring-1 transition",
                      delivery.key === d.key ? "ring-2 ring-flame" : "ring-ink/15 hover:ring-ink/40",
                    )}
                  >
                    <span className="text-sm">
                      <span className="block font-semibold">{d.name}</span>
                      <span className="block text-ink/55">{d.body}</span>
                    </span>
                    <span className="flex-none text-sm font-semibold">
                      {cost ? `$${cost.toFixed(2)}` : "Free"}
                    </span>
                  </button>
                );
              })}
            </div>

            <h2 className="mt-6 text-xl font-bold">{mailed ? "Your details and address" : "Your details"}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Name" className="col-span-2" value={who.name} onChange={set("name")} autoComplete="name" />
              <Field label="Email" className="col-span-2" type="email" value={who.email} onChange={set("email")} autoComplete="email" />
              {mailed && (
                <>
                  <Field label="Street address" className="col-span-2" value={who.line1} onChange={set("line1")} autoComplete="address-line1" />
                  <Field label="Apartment, unit (optional)" className="col-span-2" value={who.line2} onChange={set("line2")} autoComplete="address-line2" />
                  <Field label="City" className="col-span-2 sm:col-span-1" value={who.city} onChange={set("city")} autoComplete="address-level2" />
                  <Field label="Province" className="col-span-1">
                    <select className="field" value={who.province} onChange={set("province")} autoComplete="address-level1">
                      {PROVINCES.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Postal code" className="col-span-1" value={who.postal} onChange={set("postal")} autoComplete="postal-code" placeholder="V5K 0A1" />
                </>
              )}
            </div>
            {!mailed && <p className="mt-2 text-xs text-ink/50">I'll email you the pickup spot when it's ready.</p>}

            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink/60">
                  Stickers ({items.reduce((n, it) => n + it.qty, 0)} across {items.length} design{items.length > 1 ? "s" : ""})
                </dt>
                <dd>${subtotal.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/60">{delivery.name}</dt>
                <dd>{shipping ? `$${shipping.toFixed(2)}` : "Free"}</dd>
              </div>
              <div className="flex justify-between border-t border-ink/10 pt-2 font-semibold">
                <dt>Total before tax</dt>
                <dd>${(subtotal + shipping).toFixed(2)}</dd>
              </div>
            </dl>
            {error && <p className="mt-4 rounded-xl bg-flame-100 px-3 py-2 text-sm text-flame-600">{error}</p>}
            <button type="submit" disabled={busy} className="btn mt-6 w-full bg-[#635bff] text-white hover:bg-[#5249e0] disabled:opacity-70">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Pay with Stripe <ArrowRight size={16} />
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink/50">
              <CreditCard size={14} /> Card, Apple Pay and Google Pay on Stripe's secure page
            </p>
            <p className="mt-1 text-center text-xs text-ink/50">
              Your card is held, and only charged once your stickers are printed.
            </p>
          </form>
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
