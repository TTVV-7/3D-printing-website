import { Truck } from "lucide-react";
import { clsx } from "clsx";
import { stickers } from "../../site.config.js";
import { deliveryCost, lineTotal } from "./pricing.js";
import { zoneOf, parcelOf, pieceOf, fits, arrival, dateRange } from "./shipping.js";

// Each delivery option for the cart: what it costs, when it should arrive,
// and whether the order is too big for it. The postal code is optional and
// carries over to checkout.
export function DeliveryEstimate({ items, postal, onPostal }) {
  const subtotal = items.reduce((sum, it) => sum + lineTotal(it), 0);
  const parcel = parcelOf(items.map(pieceOf));
  const zone = zoneOf(postal);
  const typed = postal.replace(/\s+/g, "").length;
  // The cheapest free-over offer still out of reach, as a nudge.
  const nudge = stickers.delivery
    .filter((d) => d.freeOver && subtotal < d.freeOver && fits(d, parcel))
    .sort((a, b) => a.freeOver - b.freeOver)[0];

  return (
    <div className="mt-3 rounded-xl bg-paper p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Truck size={15} /> Delivery
        </p>
        <label className="flex items-center gap-2 text-xs text-ink/55">
          <span>Postal code</span>
          <input
            className="field h-8 w-24 px-2 py-1 text-xs uppercase"
            value={postal}
            onChange={(e) => onPostal(e.target.value)}
            placeholder="V5K 0A1"
            autoComplete="postal-code"
            maxLength={7}
            aria-label="Postal code for a delivery estimate"
          />
        </label>
      </div>
      <ul className="mt-2 space-y-1.5 text-sm">
        {stickers.delivery.map((d) => {
          const ok = fits(d, parcel);
          const cost = deliveryCost(d, subtotal);
          return (
            <li key={d.key} className={clsx("flex items-baseline justify-between gap-3", !ok && "text-ink/40")}>
              <span className="min-w-0">
                <span className="font-medium">{d.name}</span>
                <span className="block text-xs text-ink/55">
                  {ok ? `${d.days ? "Arrives" : "Ready"} ${dateRange(arrival(d, zone))}` : "Too many stickers for an envelope"}
                </span>
              </span>
              <span className="flex-none font-semibold">{ok ? (cost ? `$${cost.toFixed(2)}` : "Free") : "–"}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink/50">
        {zone
          ? `Estimated for ${zone.name}, printed in ${stickers.shipping.printDays.join("–")} business days.`
          : typed >= 6
            ? "That postal code doesn't look right (e.g. V5K 0A1)."
            : "Add your postal code for a closer date."}
        {nudge && ` Add $${(nudge.freeOver - subtotal).toFixed(2)} more for free ${nudge.name.split(",")[0]}.`}
      </p>
    </div>
  );
}
