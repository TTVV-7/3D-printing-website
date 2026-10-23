import { useEffect, useState } from "react";
import { ArrowRight, Box, CheckCircle2, Loader2, LogOut, Mail, Package, RotateCcw, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { ACCOUNTS, fetchMe, refreshMe, reorder } from "./client.js";
import { NOT_VERIFIED, turnstileHeaders, useTurnstile } from "../lib/turnstile.js";

// /account/: sign in (Google or an emailed link), then your orders with their
// status, and the sticker designs you've made. Admins also get every order
// with controls to move it along. Server side: cloudflare/accounts.js.

const KIND = { quote: "Print quote", club: "Club & team order", sticker: "Sticker order", "sticker-request": "Sticker request" };
// The usual path an order takes, for the progress bar.
const STEPS = {
  quote: ["received", "quoted", "printing", "shipped", "done"],
  club: ["received", "quoted", "printing", "shipped", "done"],
  sticker: ["paid", "printing", "shipped", "done"],
  "sticker-request": ["received", "printing", "shipped", "done"],
};
const date = (s) => new Date(s.replace(" ", "T") + "Z").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function SignIn({ error }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState({});
  const turnstile = useTurnstile();

  async function send(e) {
    e.preventDefault();
    setState({ busy: true });
    if (turnstile.needed && !(await turnstile.wait())) return setState({ error: NOT_VERIFIED });
    try {
      const r = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...turnstileHeaders() },
        body: JSON.stringify({ email, next: "/account/" }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "That didn't send. Try again.");
      setState({ sent: true });
    } catch (err) {
      setState({ error: err.message });
      turnstile.reset();
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-xl shadow-ink/5 ring-1 ring-ink/5 sm:p-8">
      <h2 className="text-2xl font-bold">Sign in</h2>
      <p className="mt-1 text-sm text-ink/60">See your orders, where they're at, and the stickers you've designed. No password needed.</p>
      {error && <p className="mt-4 rounded-xl bg-flame-100 px-3 py-2 text-sm text-flame-600">{error}</p>}
      <a href="/api/auth/google?next=/account/" className="btn mt-6 w-full border border-ink/15 bg-white text-ink hover:bg-ink/5">
        <GoogleIcon /> Continue with Google
      </a>
      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-ink/35">
        <span className="h-px flex-1 bg-ink/10" /> or <span className="h-px flex-1 bg-ink/10" />
      </div>
      {state.sent ? (
        <p className="flex items-start gap-2 rounded-xl bg-paper px-4 py-3 text-sm">
          <CheckCircle2 size={18} className="mt-0.5 flex-none text-flame" />
          <span>
            Check <strong>{email}</strong> for a sign-in link. It works once, for 20 minutes.
          </span>
        </p>
      ) : (
        <form onSubmit={send} className="space-y-3">
          <label className="block text-sm font-medium">
            Email me a sign-in link
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="field mt-1.5" autoComplete="email" />
          </label>
          {turnstile.needed && <div ref={turnstile.box} />}
          {state.error && <p className="rounded-xl bg-flame-100 px-3 py-2 text-sm text-flame-600">{state.error}</p>}
          <button type="submit" disabled={state.busy} className="btn-primary w-full disabled:opacity-60">
            {state.busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Send link
          </button>
        </form>
      )}
      <p className="mt-5 text-xs text-ink/50">Use the email you order with: your orders are matched to it.</p>
    </div>
  );
}

function Progress({ order }) {
  const steps = STEPS[order.kind] || STEPS.quote;
  const at = order.status === "ready" ? steps.indexOf("shipped") : steps.indexOf(order.status);
  if (order.status === "cancelled" || at < 0) return null;
  return (
    <div className="mt-3 flex gap-1" aria-hidden>
      {steps.map((s, i) => (
        <span key={s} className={clsx("h-1.5 flex-1 rounded-full", i <= at ? "bg-flame" : "bg-ink/10")} />
      ))}
    </div>
  );
}

function OrderCard({ order, children }) {
  return (
    <li className="flex gap-4 rounded-2xl bg-white p-4 ring-1 ring-ink/10">
      <span className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-xl bg-paper">
        {order.thumbnail ? <img src={order.thumbnail} alt="" loading="lazy" className="h-full w-full object-contain" /> : <Package size={28} className="text-ink/25" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-flame">{KIND[order.kind] || "Order"}</p>
            <p className="font-semibold leading-snug">{order.title || "Order"}</p>
            <p className="text-xs text-ink/50">
              {date(order.created_at)}
              {order.total ? ` · $${Number(order.total).toFixed(2)}` : ""}
            </p>
          </div>
          <span
            className={clsx(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              order.status === "cancelled" ? "bg-ink/10 text-ink/60" : order.status === "done" ? "bg-ink text-white" : "bg-flame-100 text-flame-600",
            )}
          >
            {order.statusName}
          </span>
        </div>
        <Progress order={order} />
        {order.tracking && <p className="mt-2 text-sm">Tracking: <strong>{order.tracking}</strong></p>}
        {order.note && <p className="mt-2 whitespace-pre-line text-sm text-ink/70">{order.note}</p>}
        {children}
      </div>
    </li>
  );
}

function Designs({ designs, onChange }) {
  const [busy, setBusy] = useState(null);
  if (!designs.length) {
    return (
      <p className="rounded-2xl bg-white p-6 text-sm text-ink/60 ring-1 ring-ink/10">
        Stickers you put in your cart while signed in are kept here, ready to order again.{" "}
        <a href="/stickers/" className="font-medium text-ink underline decoration-flame underline-offset-4">Make a sticker</a>
      </p>
    );
  }
  async function remove(d) {
    setBusy(d.id);
    await fetch(`/api/account/designs?id=${encodeURIComponent(d.id)}`, { method: "DELETE" }).catch(() => {});
    setBusy(null);
    onChange();
  }
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {designs.map((d) => (
        <li key={d.id} className="flex flex-col rounded-2xl bg-white p-3 ring-1 ring-ink/10">
          <span className="flex aspect-square items-center justify-center rounded-xl bg-paper p-3">
            <img src={d.preview || d.data.art} alt="" loading="lazy" className={clsx("max-h-full max-w-full object-contain", d.kind === "thermal" && "[image-rendering:pixelated]")} />
          </span>
          <p className="mt-2 line-clamp-2 text-xs text-ink/60">{d.title}</p>
          <div className="mt-auto flex gap-1.5 pt-2">
            <button
              type="button"
              onClick={async () => {
                setBusy(d.id);
                await reorder(d).catch(() => setBusy(null));
              }}
              disabled={busy === d.id}
              className="btn-primary h-9 flex-1 px-2 text-xs"
            >
              {busy === d.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Order again
            </button>
            <button type="button" onClick={() => remove(d)} aria-label="Remove design" className="rounded-full p-2 text-ink/45 hover:bg-ink/5 hover:text-ink">
              <Trash2 size={15} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Admins: every order, with its status, a note the customer sees and tracking.
function Admin({ statuses }) {
  const [orders, setOrders] = useState(null);
  const [edits, setEdits] = useState({});
  const [saved, setSaved] = useState({});
  const load = () =>
    fetch("/api/account/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []));
  useEffect(() => {
    load();
  }, []);
  if (!orders) return <Loader2 className="animate-spin text-ink/40" />;
  if (!orders.length) return <p className="text-sm text-ink/60">No orders yet. New quotes and sticker orders show up here as they come in.</p>;

  async function save(o) {
    const e = { status: o.status, note: o.note || "", tracking: o.tracking || "", ...edits[o.id] };
    setSaved((s) => ({ ...s, [o.id]: "saving" }));
    const r = await fetch("/api/account/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: o.id, ...e }) });
    const d = await r.json().catch(() => ({}));
    setSaved((s) => ({ ...s, [o.id]: r.ok ? (d.emailed ? "Saved, customer emailed" : "Saved") : d.error || "Didn't save" }));
    setEdits((x) => ({ ...x, [o.id]: undefined }));
    load();
  }
  const set = (o, k) => (ev) => setEdits((x) => ({ ...x, [o.id]: { ...x[o.id], [k]: ev.target.value } }));

  return (
    <ul className="space-y-3">
      {orders.map((o) => {
        const e = { status: o.status, note: o.note || "", tracking: o.tracking || "", ...edits[o.id] };
        const emails = e.status !== o.status && (e.status === "shipped" || e.status === "ready");
        return (
          <OrderCard key={o.id} order={o}>
            <p className="mt-1 text-xs text-ink/50">{o.email}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr_10rem_auto]">
              <select value={e.status} onChange={set(o, "status")} className="field h-10 py-1" aria-label="Status">
                {Object.entries(statuses).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input value={e.note} onChange={set(o, "note")} placeholder="Note the customer sees (optional)" className="field h-10 py-1" />
              <input value={e.tracking} onChange={set(o, "tracking")} placeholder="Tracking number" className="field h-10 py-1" />
              <button type="button" onClick={() => save(o)} disabled={!edits[o.id]} className="btn-primary h-10 px-4 text-sm disabled:opacity-40">
                Save
              </button>
            </div>
            {emails && <p className="mt-1.5 text-xs text-flame-600">Saving emails the customer that it's {e.status === "shipped" ? "shipped" : "ready for pickup"}.</p>}
            {saved[o.id] && <p className="mt-1.5 text-xs text-ink/55">{saved[o.id] === "saving" ? "Saving…" : saved[o.id]}</p>}
          </OrderCard>
        );
      })}
    </ul>
  );
}

export function AccountPage() {
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("orders");
  const error = typeof location !== "undefined" ? new URLSearchParams(location.search).get("error") : null;

  useEffect(() => {
    fetchMe().then(setMe);
  }, []);
  const reload = () => refreshMe().then(setMe);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    reload();
  }

  return (
    <>
      <section className="bg-ink pb-12 pt-28 text-white sm:pt-32">
        <div className="container-page flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-flame">Your account</p>
            <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{me?.user ? `Hi${me.user.name ? `, ${me.user.name.split(" ")[0]}` : ""}.` : "Your orders."}</h1>
            {me?.user && <p className="mt-2 text-white/60">{me.user.email}</p>}
          </div>
          {me?.user && (
            <button type="button" onClick={signOut} className="btn-outline-light h-10 px-4 text-sm">
              <LogOut size={15} /> Sign out
            </button>
          )}
        </div>
      </section>

      <section className="min-h-[50vh] bg-paper py-10 sm:py-14">
        <div className="container-page">
          {!ACCOUNTS ? (
            <p className="text-ink/60">Accounts are coming soon. For an order update, email or reply to your confirmation.</p>
          ) : !me ? (
            <Loader2 className="mx-auto animate-spin text-ink/40" />
          ) : !me.user ? (
            <SignIn error={error} />
          ) : (
            <>
              <div className="flex flex-wrap gap-2" role="tablist">
                {[
                  ["orders", `Orders (${me.orders.length})`],
                  ["designs", `My designs (${me.designs.length})`],
                  ...(me.admin ? [["admin", "All orders (admin)"]] : []),
                ].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={tab === k}
                    onClick={() => setTab(k)}
                    className={clsx(
                      "rounded-full px-4 py-1.5 text-sm font-medium ring-1 transition",
                      tab === k ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-6">
                {tab === "orders" &&
                  (me.orders.length ? (
                    <ul className="space-y-3">
                      {me.orders.map((o) => (
                        <OrderCard key={o.id} order={o} />
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-2xl bg-white p-6 ring-1 ring-ink/10">
                      <Box size={28} className="text-ink/25" />
                      <p className="mt-2 font-semibold">No orders yet</p>
                      <p className="mt-1 text-sm text-ink/60">Quotes and sticker orders sent from {me.user.email} show up here, with where they're at.</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a href="/#quote" className="btn-primary h-10 px-4 text-sm">
                          Get a free quote <ArrowRight size={15} />
                        </a>
                        <a href="/stickers/" className="btn-outline-dark h-10 px-4 text-sm">Make stickers</a>
                      </div>
                    </div>
                  ))}
                {tab === "designs" && <Designs designs={me.designs} onChange={reload} />}
                {tab === "admin" && me.admin && <Admin statuses={me.statuses} />}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
