import { useMemo } from "react";
import { Mail, Package, Store } from "lucide-react";
import { clsx } from "clsx";
import { guessGrams, packageOf, shippingOptions, zoneOf } from "../lib/quoteShipping.js";

// Pickup, or shipping with a guide price and time (quoteShipping.js) for the
// quote form. The parts' size comes from the measured models, or from the
// customer's rough one when there's no model.

export const DELIVERY_EMPTY = { delivery: "pickup", postal: "", sizeL: "", sizeW: "", sizeH: "", shipBy: "" };

const money = (n) => `$${n.toFixed(2)}`;
const daysText = ([a, b]) => `${a === b ? a : `${a}–${b}`} business days`;

// What the form sends: { method: "pickup" } or the chosen way to ship, with
// what it was worked out from. Null while shipping is picked but not yet
// worked out (no postal code or size).
export function useDelivery(form, estimate) {
  return useMemo(() => {
    if (form.delivery !== "ship") return { method: "pickup", summary: "Pickup in Vancouver" };
    const qty = Math.max(1, Number(form.quantity) || 1);
    const measured = estimate.parts.filter((p) => p.status === "ok" && !p.checks.unreliable);
    let items, grams, basis;
    if (measured.length) {
      items = measured.map((p) => ({ size: p.measure.size, qty }));
      grams = estimate.order?.grams ?? measured.reduce((s, p) => s + guessGrams(p.measure.size, qty, form.material), 0);
      basis = "model";
    } else {
      const size = [form.sizeL, form.sizeW, form.sizeH].map((v) => Number(v) * 10);
      if (!size.every((v) => v > 0)) {
        return {
          method: "ship",
          zone: zoneOf(form.postal),
          postal: form.postal.trim().toUpperCase(),
          summary: `Ship to ${form.postal.trim().toUpperCase() || "(no postal code)"}; no size given, so shipping still to work out.`,
        };
      }
      items = [{ size, qty }];
      grams = guessGrams(size, qty, form.material);
      basis = "customer";
    }
    const pkg = packageOf(items, grams);
    const { zone, options } = shippingOptions(pkg, form.postal);
    const usable = options.filter((o) => o.ok);
    const chosen = usable.find((o) => o.key === form.shipBy) || usable[0] || null;
    return {
      method: "ship",
      zone,
      options,
      chosen,
      basis,
      grams,
      pkg,
      postal: form.postal.trim().toUpperCase(),
      summary: chosen
        ? `${chosen.name} to ${form.postal.trim().toUpperCase() || "(no postal code)"}: about ${chosen.from ? "from " : ""}${money(chosen.price)}, ${daysText(chosen.days)} in the mail. Worked out from ${basis === "model" ? "the model" : "the size they gave"}, about ${Math.round(grams)} g.`
        : "Ship it, but too big to post: arrange delivery.",
    };
  }, [form.delivery, form.postal, form.sizeL, form.sizeW, form.sizeH, form.shipBy, form.quantity, form.material, estimate]);
}

// For the request: what's chosen, as data for the admin panel and emails.
export function deliveryEntry(d) {
  if (d.method === "pickup") return { method: "pickup" };
  return {
    method: "ship",
    postal: d.postal || null,
    by: d.chosen?.key || null,
    price: d.chosen ? Math.round(d.chosen.price * 100) / 100 : null,
    days: d.chosen?.days || null,
    sizeFrom: d.basis || null,
    grams: d.grams ? Math.round(d.grams) : null,
  };
}

export function Delivery({ form, setForm, delivery, hasModel }) {
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const chip = (on) =>
    clsx("flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm ring-1 transition", on ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40");

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1.5 text-sm font-medium text-ink/75">Getting it to you</legend>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setForm((f) => ({ ...f, delivery: "pickup" }))} aria-pressed={form.delivery === "pickup"} className={chip(form.delivery === "pickup")}>
          <Store size={16} /> <span><span className="block font-semibold">Pick it up</span><span className={clsx("block text-xs", form.delivery === "pickup" ? "text-white/60" : "text-ink/50")}>Vancouver, free</span></span>
        </button>
        <button type="button" onClick={() => setForm((f) => ({ ...f, delivery: "ship" }))} aria-pressed={form.delivery === "ship"} className={chip(form.delivery === "ship")}>
          <Package size={16} /> <span><span className="block font-semibold">Ship it to me</span><span className={clsx("block text-xs", form.delivery === "ship" ? "text-white/60" : "text-ink/50")}>Anywhere in Canada</span></span>
        </button>
      </div>

      {form.delivery === "ship" && (
        <div className="space-y-3 rounded-2xl bg-paper p-3.5 ring-1 ring-ink/10">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink/75">
              Postal code {delivery.zone && <span className="font-normal text-ink/45">· {delivery.zone.name}</span>}
            </span>
            <input className="field block max-w-[12rem] uppercase" value={form.postal} onChange={set("postal")} autoComplete="postal-code" placeholder="V5K 0A1" maxLength={7} />
          </label>

          {!hasModel && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink/75">
                Rough size of the finished part <span className="font-normal text-ink/40">(cm, a guess is fine)</span>
              </p>
              <div className="flex items-center gap-2">
                {[["sizeL", "Length"], ["sizeW", "Width"], ["sizeH", "Height"]].map(([k, name], i) => (
                  <span key={k} className="flex items-center gap-2">
                    {i > 0 && <span className="text-ink/40">×</span>}
                    <input className="field w-20" type="number" min="0" step="any" inputMode="decimal" value={form[k]} onChange={set(k)} placeholder={name} aria-label={`${name} in cm`} />
                  </span>
                ))}
              </div>
              <p className="text-xs text-ink/50">Or add the model above and it's measured for you.</p>
            </div>
          )}

          {delivery.options && (
            <div className="space-y-2" role="radiogroup" aria-label="How to send it">
              {delivery.options.map((o) => {
                const on = delivery.chosen?.key === o.key;
                const Icon = o.tracked ? Package : Mail;
                return (
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!o.ok}
                    onClick={() => setForm((f) => ({ ...f, shipBy: o.key }))}
                    className={clsx("flex w-full items-start gap-3 rounded-xl bg-white p-3 text-left text-sm ring-1 transition disabled:opacity-50", on ? "ring-2 ring-flame" : "ring-ink/15 hover:ring-ink/40")}
                  >
                    <Icon size={18} className="mt-0.5 flex-none text-flame" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{o.name}</span>
                      <span className="block text-xs text-ink/55">
                        {o.ok ? `${daysText(o.days)} in the mail, once it's printed` : o.why}
                      </span>
                    </span>
                    {o.ok && o.price != null && (
                      <span className="font-semibold">{o.from && <span className="text-xs font-normal text-ink/50">from </span>}{money(o.price)}</span>
                    )}
                  </button>
                );
              })}
              <p className="text-xs text-ink/50">
                {delivery.basis === "model" ? `Packed from your model, about ${Math.round(delivery.grams)} g. ` : ""}
                A guide price: your quote confirms it.{!delivery.zone && " Add your postal code for your delivery dates."}
              </p>
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}
