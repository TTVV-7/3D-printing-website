import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { clsx } from "clsx";

// /account/ → Stats (admins only): visits, clicks, orders and uploads over
// time, by hour of the day, by page and by place, and who sends files.
// Data from /api/account/stats (cloudflare/stats.js); times are Vancouver time.

const TZ = "America/Vancouver";
const RANGES = [
  [7, "7 days"],
  [30, "30 days"],
  [90, "90 days"],
  [365, "1 year"],
];
// Fixed categorical order: an order kind keeps its colour whatever's shown.
const KIND = {
  quote: ["Print quotes", "#2a78d6"],
  sticker: ["Sticker orders", "#eb6834"],
  "sticker-request": ["Sticker requests", "#1baf7a"],
  club: ["Club & team", "#eda100"],
};
const BLUE = "#2a78d6";
// Sequential blue, light to dark, for the heat map.
const RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const n0 = (n) => Number(n || 0).toLocaleString("en-CA");
const pct = (n) => `${Math.round(n * 100)}%`;
const money = (n) => `$${Number(n || 0).toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
const hourName = (h) => (h === 0 ? "12 am" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`);
const utc = (s) => new Date(String(s).replace(" ", "T") + "Z");
const when = (s) => utc(s).toLocaleString("en-CA", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const day = (iso, opts = { month: "short", day: "numeric" }) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", { timeZone: "UTC", ...opts });
const regions = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const country = (code) => {
  if (!code || code === "XX" || code === "T1") return "Unknown";
  try {
    return regions?.of(code) || code;
  } catch {
    return code;
  }
};

// ---- Pieces ---------------------------------------------------------------

function Card({ title, note, children, className }) {
  return (
    <section className={clsx("rounded-2xl bg-white p-4 ring-1 ring-ink/10 sm:p-5", className)}>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-ink/50">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Kpi({ label, value, prev, hint }) {
  const change = prev != null && prev > 0 ? (Number(value) - prev) / prev : null;
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/10">
      <p className="text-xs font-medium uppercase tracking-wider text-ink/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{typeof value === "number" ? n0(value) : value}</p>
      <p className="mt-0.5 text-xs text-ink/50">
        {change != null ? (
          <>
            <span className={clsx("font-medium", change >= 0 ? "text-emerald-700" : "text-ink/70")}>
              {change >= 0 ? "▲" : "▼"} {pct(Math.abs(change))}
            </span>{" "}
            vs previous period
          </>
        ) : (
          hint || " "
        )}
      </p>
    </div>
  );
}

// A tooltip that follows the pointer inside a relatively positioned box.
function useTip() {
  const box = useRef(null);
  const [tip, setTip] = useState(null);
  const show = (content) => (e) => {
    const r = box.current.getBoundingClientRect();
    setTip({ content, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width });
  };
  const el = tip && (
    <div
      className="pointer-events-none absolute z-10 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg"
      style={{ left: Math.min(Math.max(tip.x, 70), tip.w - 70), top: tip.y - 10, transform: "translate(-50%, -100%)", whiteSpace: "nowrap" }}
    >
      {tip.content}
    </div>
  );
  return { box, show, hide: () => setTip(null), el };
}

function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
}

// Columns over time, one series or stacked. `series` is [[key, label, colour]].
function Columns({ rows, series, label, tipFor, height = 180 }) {
  const t = useTip();
  const W = 720;
  const H = height;
  const pad = { l: 34, r: 6, t: 8, b: 22 };
  const total = (r) => series.reduce((s, [k]) => s + (r[k] || 0), 0);
  const max = niceMax(Math.max(1, ...rows.map(total)));
  const slot = (W - pad.l - pad.r) / Math.max(rows.length, 1);
  const bw = Math.max(1, Math.min(24, slot - 2));
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, max / 2, max];
  const every = Math.ceil(rows.length / 8);

  return (
    <div ref={t.box} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={label} onMouseLeave={t.hide}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#0c1a2e" strokeOpacity="0.08" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#0c1a2e" fillOpacity="0.5">
              {n0(v)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x = pad.l + i * slot + (slot - bw) / 2;
          let base = 0;
          const parts = series.filter(([k]) => r[k] > 0);
          return (
            <g key={r.key}>
              {parts.map(([k, , colour], j) => {
                const top = base + r[k];
                const y0 = y(base);
                const y1 = y(top);
                base = top;
                const last = j === parts.length - 1;
                const h = Math.max(1, y0 - y1 - (last ? 0 : 2));
                const rr = last ? Math.min(4, bw / 2, h) : 0;
                return <path key={k} d={roundTop(x, y0 - h, bw, h, rr)} fill={colour} />;
              })}
              {i % every === 0 && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#0c1a2e" fillOpacity="0.5">
                  {r.short}
                </text>
              )}
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" onMouseMove={t.show(tipFor(r))} />
            </g>
          );
        })}
      </svg>
      {t.el}
    </div>
  );
}

// A bar rect with its top corners rounded and its base square.
function roundTop(x, y, w, h, r) {
  if (!r) return `M${x},${y}h${w}v${h}h${-w}z`;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}z`;
}

function Legend({ series }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/70">
      {series.map(([k, label, colour]) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colour }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// Weekday × hour of day.
function Heat({ grid, unit }) {
  const t = useTip();
  const max = Math.max(1, ...grid.flat());
  const colour = (v) => (v ? RAMP[Math.min(RAMP.length - 1, Math.floor((v / max) * (RAMP.length - 1e-9)))] : "#0c1a2e0d");
  const byHour = Array.from({ length: 24 }, (_, h) => grid.reduce((s, row) => s + row[h], 0));
  const peak = byHour.indexOf(Math.max(...byHour));
  return (
    <div ref={t.box} className="relative" onMouseLeave={t.hide}>
      <div className="overflow-x-auto">
        <div className="grid min-w-[520px] grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-[2px] text-[10px] text-ink/50">
          <span />
          {byHour.map((_, h) => (
            <span key={h} className="text-center">
              {h % 3 === 0 ? hourName(h).replace(" ", "") : ""}
            </span>
          ))}
          {grid.map((row, d) => (
            <div key={d} className="contents">
              <span className="pr-1 text-right leading-5">{DAYS[d]}</span>
              {row.map((v, h) => (
                <span
                  key={h}
                  className="h-5 rounded-[3px]"
                  style={{ background: colour(v) }}
                  onMouseMove={t.show(`${DAYS[d]} ${hourName(h)}–${hourName((h + 1) % 24)}: ${n0(v)} ${unit}`)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink/55">
        <span>{max > 1 || grid.flat().some(Boolean) ? `Busiest hour: ${hourName(peak)}–${hourName((peak + 1) % 24)}` : "Nothing yet"}</span>
        <span className="flex items-center gap-1">
          Fewer
          {RAMP.map((c) => (
            <span key={c} className="h-2.5 w-3 rounded-sm" style={{ background: c }} />
          ))}
          More
        </span>
      </div>
      {t.el}
    </div>
  );
}

// A ranked list with a thin bar per row.
function Bars({ rows, empty = "Nothing yet.", extra }) {
  if (!rows.length) return <p className="text-sm text-ink/50">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate" title={r.title || r.label}>
              {r.label}
              {r.sub && <span className="ml-1.5 text-xs text-ink/45">{r.sub}</span>}
            </span>
            <span className="flex-none tabular-nums text-ink/70">
              {n0(r.n)}
              {extra && r.extra != null && <span className="ml-2 text-xs text-ink/45">{r.extra}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-ink/5">
            <div className="h-1.5 rounded-full" style={{ width: `${Math.max(2, (r.n / max) * 100)}%`, background: BLUE }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Segmented({ value, onChange, options, label }) {
  return (
    <div className="inline-flex rounded-full bg-paper p-0.5 ring-1 ring-ink/10" role="group" aria-label={label}>
      {options.map(([k, text]) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={clsx("rounded-full px-3 py-1 text-xs font-medium transition", value === k ? "bg-ink text-white" : "text-ink/70 hover:text-ink")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

// ---- Customers ------------------------------------------------------------

function Customers({ customers }) {
  const [open, setOpen] = useState(null);
  const [onlyFiles, setOnlyFiles] = useState(false);
  const shown = customers.filter((c) => !onlyFiles || c.files > 0);
  if (!customers.length) return <p className="text-sm text-ink/50">No orders in this period.</p>;
  return (
    <>
      <label className="mb-3 flex items-center gap-2 text-xs text-ink/60">
        <input type="checkbox" checked={onlyFiles} onChange={(e) => setOnlyFiles(e.target.checked)} className="accent-flame" />
        Only people who uploaded files
      </label>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink/45">
            <tr>
              <th className="pb-2 font-medium">Customer</th>
              <th className="pb-2 text-right font-medium">Orders</th>
              <th className="pb-2 text-right font-medium">Files</th>
              <th className="pb-2 text-right font-medium">Total</th>
              <th className="pb-2 pl-4 font-medium">Usually sends</th>
              <th className="pb-2 font-medium">Last</th>
              <th className="pb-2 font-medium">From</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => {
              const peak = c.hours.indexOf(Math.max(...c.hours));
              const isOpen = open === c.email;
              return (
                <Fragment key={c.email}>
                  <tr className="cursor-pointer border-t border-ink/5 hover:bg-paper/60" onClick={() => setOpen(isOpen ? null : c.email)}>
                    <td className="py-2 pr-2">
                      <span className="flex items-center gap-1">
                        {isOpen ? <ChevronDown size={14} className="flex-none text-ink/40" /> : <ChevronRight size={14} className="flex-none text-ink/40" />}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.name || c.email}</span>
                          {c.name && <span className="block truncate text-xs text-ink/50">{c.email}</span>}
                        </span>
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{c.orders}</td>
                    <td className="py-2 text-right tabular-nums">{c.files}</td>
                    <td className="py-2 text-right tabular-nums">{c.total ? money(c.total) : "–"}</td>
                    <td className="py-2 pl-4 text-ink/70">{hourName(peak)}</td>
                    <td className="py-2 whitespace-nowrap text-ink/70">{when(c.last)}</td>
                    <td className="max-w-[12rem] truncate py-2 text-ink/70" title={c.places.join(" · ")}>
                      {c.places[0] || "–"}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-paper/60">
                      <td colSpan={7} className="px-3 py-2">
                        <ul className="space-y-1 text-xs">
                          {c.list.map((o) => (
                            <li key={o.id} className="flex flex-wrap gap-x-3">
                              <span className="w-28 flex-none text-ink/55">{when(o.at)}</span>
                              <span className="flex-none font-medium">{(KIND[o.kind] || KIND.quote)[0].replace(/s$/, "")}</span>
                              <span className="min-w-0 flex-1 truncate">{o.title || "Order"}</span>
                              <span className="text-ink/55">
                                {o.files} file{o.files === 1 ? "" : "s"}
                                {o.total ? ` · ${money(o.total)}` : ""}
                                {o.place ? ` · ${o.place}` : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---- Recent activity --------------------------------------------------------

function describe(e) {
  const d = e.detail || {};
  if (e.name === "Click") return `Clicked “${d.label || "?"}”${d.href ? ` → ${d.href}` : ""}`;
  if (e.name === "Page view") return d.landing ? `Arrived on ${e.page}` : `Viewed ${e.page}`;
  const bits = Object.entries(d)
    .filter(([, v]) => v !== null && v !== "" && typeof v !== "object")
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${v}`);
  return `${e.name}${bits.length ? ` (${bits.join(", ")})` : ""}`;
}

function Recent({ events }) {
  const [hideClicks, setHideClicks] = useState(false);
  const shown = events.filter((e) => !hideClicks || e.name !== "Click");
  return (
    <>
      <label className="mb-3 flex items-center gap-2 text-xs text-ink/60">
        <input type="checkbox" checked={hideClicks} onChange={(e) => setHideClicks(e.target.checked)} className="accent-flame" />
        Hide clicks
      </label>
      {!shown.length ? (
        <p className="text-sm text-ink/50">Nothing yet.</p>
      ) : (
        <ul className="max-h-96 space-y-1.5 overflow-y-auto pr-1 text-sm">
          {shown.map((e, i) => (
            <li key={i} className="flex gap-3 border-b border-ink/5 pb-1.5">
              <span className="w-24 flex-none text-xs leading-5 text-ink/50">{when(e.at)}</span>
              <span className="min-w-0 flex-1">
                <span className={clsx(!["Page view", "Click"].includes(e.name) && "font-semibold")}>{describe(e)}</span>
                <span className="block text-xs text-ink/45">
                  {[e.place && e.place !== e.country ? e.place : country(e.country), e.device, e.source && e.source !== "unknown" ? `via ${e.source}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ---- The page -------------------------------------------------------------

// Long ranges are drawn a week per column.
function buckets(daily, days) {
  const rows = daily.map((d) => ({ ...d, key: d.date, short: day(d.date), long: day(d.date, { weekday: "short", month: "short", day: "numeric" }) }));
  if (days <= 90) return rows;
  const out = [];
  for (let i = 0; i < rows.length; i += 7) {
    const week = rows.slice(i, i + 7);
    const sum = { key: week[0].date, short: day(week[0].date), long: `Week of ${day(week[0].date)}` };
    for (const r of week) for (const k of ["visits", "pageViews", "visitors", "files", ...Object.keys(KIND)]) sum[k] = (sum[k] || 0) + (r[k] || 0);
    out.push(sum);
  }
  return out;
}

export function AdminStats() {
  const [days, setDays] = useState(() => {
    try {
      return Number(localStorage.getItem("py_admin_stats_days")) || 30;
    } catch {
      return 30;
    }
  });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [heat, setHeat] = useState("visits");

  const load = (d = days) => {
    setBusy(true);
    setError(null);
    fetch(`/api/account/stats?days=${d}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `Couldn't load stats (${r.status})`);
        setData(body);
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };
  useEffect(() => {
    load(days);
  }, [days]);
  const pick = (d) => {
    setDays(d);
    try {
      localStorage.setItem("py_admin_stats_days", String(d));
    } catch {}
  };

  const rows = useMemo(() => (data ? buckets(data.daily, data.days) : []), [data]);
  const kinds = Object.entries(KIND).map(([k, [label, colour]]) => [k, label, colour]);

  const header = (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <Segmented value={days} onChange={pick} options={RANGES} label="Time range" />
      <button type="button" onClick={() => load()} disabled={busy} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-ink/60 ring-1 ring-ink/15 hover:text-ink disabled:opacity-50">
        <RefreshCw size={13} className={clsx(busy && "animate-spin")} /> Refresh
      </button>
    </div>
  );

  if (error) return <>{header}<p className="rounded-xl bg-flame-100 px-3 py-2 text-sm text-flame-600">{error}</p></>;
  if (!data) return <>{header}<Loader2 className="animate-spin text-ink/40" /></>;

  const T = data.totals;
  const conversion = T.visits ? T.orders / T.visits : 0;
  return (
    <div className={clsx("transition-opacity", busy && "opacity-60")}>
      {header}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Visits" value={T.visits} prev={data.previous.visits} />
        <Kpi label="Page views" value={T.pageViews} prev={data.previous.pageViews} />
        <Kpi label="Orders & quotes" value={T.orders} prev={data.previous.orders} />
        <Kpi label="Files uploaded" value={T.files} hint={`from ${n0(T.uploaders)} ${T.uploaders === 1 ? "person" : "people"}`} />
        <Kpi label="Orders per visit" value={T.visits ? pct(conversion) : "–"} hint="orders ÷ visits" />
        <Kpi label="Order value" value={money(T.revenue)} hint={`${n0(T.newAccounts)} new account${T.newAccounts === 1 ? "" : "s"}`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Visits" note={data.days > 90 ? "Per week" : "Per day"}>
          <Columns
            rows={rows}
            series={[["visits", "Visits", BLUE]]}
            label="Visits over time"
            tipFor={(r) => `${r.long}: ${n0(r.visits)} visits · ${n0(r.pageViews)} page views${r.visitors ? ` · ${n0(r.visitors)} remembered visitors` : ""}`}
          />
        </Card>
        <Card title="Orders & quotes" note={data.days > 90 ? "Per week, by kind" : "Per day, by kind"}>
          <Columns
            rows={rows}
            series={kinds}
            label="Orders over time by kind"
            tipFor={(r) =>
              `${r.long}: ${kinds.filter(([k]) => r[k]).map(([k, label]) => `${r[k]} ${label.toLowerCase()}`).join(", ") || "no orders"}${r.files ? ` · ${r.files} files` : ""}`
            }
          />
          <Legend series={kinds} />
        </Card>
      </div>

      <Card
        className="mt-4"
        title="When people come by"
        note="Vancouver time, by day of the week and hour"
      >
        <div className="mb-3">
          <Segmented value={heat} onChange={setHeat} options={[["visits", "Visits"], ["orders", "Orders"]]} label="Heat map" />
        </div>
        <Heat grid={data.heat[heat]} unit={heat === "visits" ? "visits" : "orders"} />
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Top pages" note="Page views">
          <Bars rows={data.pages.map((p) => ({ label: p.page || "/", n: p.n }))} />
        </Card>
        <Card title="What people click" note="Links and buttons, by label">
          <Bars rows={data.clicks.map((c) => ({ label: c.label, sub: c.href && c.href !== c.label ? `→ ${c.href}` : null, title: [c.label, c.href, `on ${c.pages} page${c.pages === 1 ? "" : "s"}`].filter(Boolean).join(" · "), n: c.n }))} />
        </Card>
        <Card title="Where visitors came from" note="Visits, then orders from each">
          <Bars extra rows={data.sources.map((s) => ({ label: s.source, n: s.visits || 0, extra: s.orders ? `${s.orders} order${s.orders === 1 ? "" : "s"}` : "" }))} />
        </Card>
        <Card title="Countries" note="Page views">
          <Bars rows={data.countries.map((c) => ({ label: country(c.country), n: c.n }))} />
        </Card>
        <Card title="Cities" note={`Visitors who accepted cookies (${pct(T.remembered)} of page views)`}>
          <Bars empty="No one has accepted cookies yet." rows={data.cities.map((c) => ({ label: c.city, sub: [c.region, c.country].filter(Boolean).join(", "), n: c.n }))} />
        </Card>
        <Card title="Where orders come from" note="Rough place each order was sent from">
          <Bars empty="No orders with a place yet." rows={data.orderPlaces.map((p) => ({ label: p.where, n: p.n }))} />
        </Card>
        <Card title="Devices" note="Page views">
          <Bars rows={data.devices.map((d) => ({ label: d.device ? d.device[0].toUpperCase() + d.device.slice(1) : "Unknown", n: d.n }))} />
        </Card>
        <Card title="Things people did" note="Quotes, checkouts, chats, videos…">
          <Bars rows={data.events.map((e) => ({ label: e.name, n: e.n }))} />
        </Card>
        <Card title="Visitors" note="Counted only for people who accepted cookies">
          <Bars
            empty="No one has accepted cookies yet."
            rows={T.visitors ? [{ label: "New", n: T.visitors - T.returning }, { label: "Came back", n: T.returning }] : []}
          />
        </Card>
      </div>

      <Card className="mt-4" title="Customers and uploads" note="Everyone who sent an order or files in this period. Click a row for their orders.">
        <Customers customers={data.customers} />
      </Card>

      <Card className="mt-4" title="Latest activity" note="The last 60 things visitors did, newest first">
        <Recent events={data.recent} />
      </Card>

      <p className="mt-4 text-xs text-ink/45">
        Your own visits while signed in as an admin aren't counted. Countries and devices are counted for everyone; return visits and cities only for people who
        accept cookies. Plain totals: <a href="/api/stats" className="underline">/api/stats</a> (needs the STATS_KEY).
      </p>
    </div>
  );
}
