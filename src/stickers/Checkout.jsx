import { useEffect, useState } from "react";
import { X, Lock, CreditCard, ArrowRight, Loader2, Heart, Send, CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";
import { stickers } from "../../site.config.js";
import { deliveryCost, sizeOf, lineTotal, itemLabel, isColour, itemSizeName } from "./pricing.js";
import { zoneOf, parcelOf, pieceOf, fits, arrival, dateRange } from "./shipping.js";

// Sends each cart line's print file to api/sticker-upload.js, which stores
// it in this site's Blob store, then sends the cart to
// api/sticker-checkout.js,
// which hands back a Stripe Checkout page to go to. Until a Stripe key is set
// there (or in `npm run dev`, where /api goes to the store backend) it can't,
// and this says so instead. Friends and family can send the cart as a request
// instead (api/sticker-request.js): no payment, just the order email.

export async function uploadArt(dataUrl, name) {
  try {
    const r = await fetch("/api/sticker-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, data: dataUrl }),
    });
    const { url, error } = await r.json();
    if (!url) throw new Error(error || `HTTP ${r.status}`);
    return url;
  } catch (err) {
    // The order still has every setting; the image can be rebuilt from them.
    console.warn("sticker print file not uploaded:", err);
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

export function Checkout({ items, postal = "", onPostal, onRemove, onClose, onSent }) {
  const [step, setStep] = useState("pay"); // pay -> (Stripe) | preview | sent
  const [family, setFamily] = useState(false); // friends & family: a request, no payment
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [delivery, setDelivery] = useState(stickers.delivery[0]);
  const [who, setWho] = useState({ name: "", email: "", line1: "", line2: "", city: "", province: "BC", postal });
  const [error, setError] = useState("");
  const set = (k) => (e) => {
    setWho((w) => ({ ...w, [k]: e.target.value }));
    // The cart's delivery estimate follows the address.
    if (k === "postal") onPostal?.(e.target.value);
  };
  const mailed = delivery.key !== "pickup";

  // Once a request is sent, closing empties the cart too.
  const close = step === "sent" ? onSent : onClose;
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const subtotal = items.reduce((sum, it) => sum + lineTotal(it), 0);
  const shipping = deliveryCost(delivery, subtotal);
  const parcel = parcelOf(items.map(pieceOf));
  const zone = zoneOf(who.postal);

  // Too big for the delivery picked (say it was picked before more went in):
  // move to the first that fits.
  useEffect(() => {
    if (!fits(delivery, parcel)) setDelivery(stickers.delivery.find((d) => fits(d, parcel)) || stickers.delivery[0]);
  }, [delivery, parcel.grams, parcel.mm]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // The black-on-white print file (thermal) or the full-colour one; carts
      // saved before it existed send the preview. Colour files may already be
      // uploaded (ColourStudio uploads them as they go in the cart).
      const arts = await Promise.all(
        items.map((it, i) =>
          isColour(it)
            ? it.printUrl || uploadArt(it.print || it.art, `${i + 1}-colour-${Math.round(it.w)}x${Math.round(it.h)}mm-x${it.qty}`)
            : uploadArt(it.print || it.art, `${i + 1}-${sizeOf(it.sizeKey).code}-x${it.qty}`),
        ),
      );
      // The sticker as shown on screen, for the customer's confirmation email.
      const previews = await Promise.all(items.map((it, i) => uploadArt(it.art, `${i + 1}-preview`)));
      const r = await fetch(family ? "/api/sticker-request" : "/api/sticker-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(family && { message: message.trim() }),
          items: items.map((it, i) => ({
            ...(isColour(it) && { kind: "colour", w: it.w, h: it.h, shape: it.shape }),
            size: it.sizeKey,
            ring: it.ring,
            finish: it.finishKey,
            colour: it.colourKey,
            qty: it.qty,
            ink: it.ink,
            file: it.fileName,
            art: arts[i],
            preview: previews[i],
            source: it.sourceUrl,
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
      if (family) {
        setBusy(false);
        if (r.ok) return setStep("sent");
        return setError("That didn't send. Try again, or email me the design.");
      }
      const { url } = r.ok ? await r.json() : {};
      if (url) return window.location.assign(url);
    } catch {
      // Fall through to the not-set-up message.
    }
    setBusy(false);
    if (family) return setError("That didn't send. Try again, or email me the design.");
    setStep("preview");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Check out"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-2xl sm:rounded-3xl"
      >
        <button type="button" onClick={close} className="absolute right-4 top-4 rounded-full p-2 hover:bg-ink/5" aria-label="Close">
          <X size={18} />
        </button>
        <p className="font-mono text-[10px] uppercase tracking-widest text-flame">Check out</p>

        <ul className="mt-4 divide-y divide-ink/10 rounded-2xl bg-white px-3 ring-1 ring-ink/10">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-2.5">
              <img src={it.art} alt="" className={clsx("h-14 w-14 flex-none rounded-xl bg-paper-dark object-contain p-1", !isColour(it) && "[image-rendering:pixelated]")} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">
                  {it.qty} × {itemSizeName(it)} sticker{it.qty > 1 ? "s" : ""}
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
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink/5 p-1 text-sm font-semibold" role="radiogroup" aria-label="How to order">
              {[
                [false, "Pay now"],
                [true, "Friends & family"],
              ].map(([v, label]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={family === v}
                  onClick={() => {
                    setFamily(v);
                    setError("");
                  }}
                  className={clsx("rounded-lg px-3 py-2 transition", family === v ? "bg-white shadow-sm ring-1 ring-ink/10" : "text-ink/55 hover:text-ink")}
                >
                  {label}
                </button>
              ))}
            </div>
            {family && (
              <p className="mt-3 flex gap-2 rounded-xl bg-flame-100 px-3 py-2 text-sm text-ink/75">
                <Heart size={16} className="mt-0.5 flex-none text-flame" />
                Know me? Send this as a request instead of paying. I'll get your design and be in touch.
              </p>
            )}

            <h2 className="mt-6 text-xl font-bold">Delivery</h2>
            <div className="mt-3 space-y-2" role="radiogroup" aria-label="Delivery">
              {stickers.delivery.map((d) => {
                const cost = deliveryCost(d, subtotal);
                const ok = fits(d, parcel);
                return (
                  <button
                    key={d.key}
                    type="button"
                    role="radio"
                    aria-checked={delivery.key === d.key}
                    disabled={!ok}
                    onClick={() => setDelivery(d)}
                    className={clsx(
                      "flex w-full items-start justify-between gap-3 rounded-xl bg-white p-3 text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-50",
                      delivery.key === d.key ? "ring-2 ring-flame" : "ring-ink/15 hover:ring-ink/40",
                    )}
                  >
                    <span className="text-sm">
                      <span className="block font-semibold">{d.name}</span>
                      <span className="block text-ink/55">{ok ? d.body : "Too many stickers for an envelope. Pick tracked mail or pickup."}</span>
                      {ok && (
                        <span className="mt-0.5 block text-xs font-medium text-flame-600">
                          {d.days ? "Arrives" : "Ready"} {dateRange(arrival(d, zone))}
                          {d.days && !zone && " (add your postal code for a closer date)"}
                        </span>
                      )}
                    </span>
                    <span className="flex-none text-sm font-semibold">
                      {ok ? (cost ? `$${cost.toFixed(2)}` : "Free") : "–"}
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
            {family && (
              <Field label="Message (optional)" className="mt-3">
                <textarea
                  className="field min-h-[5rem]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={1000}
                  placeholder="Who you are, when you need them..."
                />
              </Field>
            )}

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
                <dt>{family ? "Usually, before tax" : "Total before tax"}</dt>
                <dd className={clsx(family && "text-ink/45 line-through")}>${(subtotal + shipping).toFixed(2)}</dd>
              </div>
            </dl>
            {error && <p className="mt-4 rounded-xl bg-flame-100 px-3 py-2 text-sm text-flame-600">{error}</p>}
            {family ? (
              <button type="submit" disabled={busy} className="btn-primary mt-6 w-full disabled:opacity-70">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send request
              </button>
            ) : (
              <>
                <button type="submit" disabled={busy} className="btn mt-6 w-full bg-[#635bff] text-white hover:bg-[#5249e0] disabled:opacity-70">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Pay with Stripe <ArrowRight size={16} />
                </button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink/50">
                  <CreditCard size={14} /> Card, Apple Pay and Google Pay on Stripe's secure page
                </p>
                <p className="mt-1 text-center text-xs text-ink/50">
                  Your card is held, and only charged once your stickers are printed.
                </p>
              </>
            )}
          </form>
        )}

        {step === "sent" && (
          <div className="mt-6 text-center">
            <CheckCircle2 size={36} className="mx-auto text-flame" />
            <h2 className="mt-3 text-2xl font-bold">Request sent!</h2>
            <p className="mt-2 text-sm text-ink/60">
              I've got your design{items.length > 1 ? "s" : ""} and will be in touch at {who.email.trim()}.
            </p>
            <button type="button" onClick={onSent} className="btn-primary mt-6">
              Done
            </button>
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
