import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { clsx } from "clsx";
import { track } from "@vercel/analytics";
import { FileDrop } from "../components/FileDrop.jsx";
import { printRequests as api } from "../lib/api.js";
import { turnstileHeaders, useTurnstile } from "../lib/turnstile.js";
import { site } from "../../site.config.js";

// Club, team and shop orders from the /bike page: a logo, what it's for, how
// many and by when. Lands in the admin panel with the other quote requests
// (tagged "Clubs & teams: "), and the customer gets the same confirmation
// email, so nothing new is needed on the store backend.

const WHAT = [
  ["stickers", "Stickers"],
  ["stickers-prints", "Stickers and 3D prints"],
  ["plates", "Race number plates"],
  ["unsure", "Not sure yet"],
];
const KINDS = [
  ["unsure", "Not sure, recommend one"],
  ["thermal", "Thermal: black on a label, cheapest"],
  ["colour", "Full colour vinyl, cut to shape"],
];
const QUANTITIES = ["25", "50", "100", "250", "500+"];

const EMPTY = { name: "", email: "", club: "", what: "stickers", kind: "unsure", quantity: "50", deadline: "", details: "", allowed: false };

function Field({ label, required, hint, className, children }) {
  return (
    <label className={clsx("block space-y-1.5", className)}>
      <span className="text-sm font-medium text-ink/75">
        {label}
        {required && <span className="text-flame"> *</span>}
        {hint && <span className="font-normal text-ink/40"> {hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function ClubForm() {
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const label = (list, key) => list.find(([k]) => k === key)?.[1];

  const turnstile = useTurnstile();

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!files.length) return setError("Add your logo, so I can quote from it.");
    if (!form.allowed) return setError("Please confirm the logo is yours to use.");
    if (turnstile.needed && !turnstile.token) return setError("One moment, checking you're not a bot… try again in a second.");
    setBusy(true);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const uploaded = [];
    try {
      const { uploadPresigned } = await import("@vercel/blob/client");
      for (const [i, file] of files.entries()) {
        setProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);
        // Private store (api/quote-upload.js); the link opens it through this site.
        const blob = await uploadPresigned(`requests/${id}/${file.name}`, file, {
          access: "private",
          handleUploadUrl: "/api/quote-upload",
        });
        uploaded.push({ name: file.name, size: file.size, url: `${location.origin}/api/sticker-file?p=${encodeURIComponent(blob.pathname)}` });
      }
    } catch {
      setProgress(null);
      setBusy(false);
      return setError(`Couldn't upload ${files[uploaded.length]?.name ?? "your logo"}. Try a PNG, or email it instead.`);
    }
    setProgress(null);

    // Everything the form asked, as lines in the request's details.
    const details = [
      `Club / team: ${form.club.trim()}`,
      `For: ${label(WHAT, form.what)}`,
      form.what !== "plates" && `Stickers: ${label(KINDS, form.kind)}`,
      `Quantity: ${form.quantity}`,
      "Logo use: confirmed theirs or permitted",
      form.details.trim() && `\n${form.details.trim()}`,
    ].filter(Boolean).join("\n");

    // Same shape the store backend takes from the quote form.
    const entry = {
      id,
      mode: "description",
      name: form.name.trim(),
      email: form.email.trim(),
      details,
      url: null,
      material: null,
      quality: null,
      quantity: parseInt(form.quantity, 10) || 1,
      deadline: form.deadline || null,
      budget: null,
      files: uploaded,
      title: `Clubs & teams: ${form.club.trim()} · ${form.quantity} ${label(WHAT, form.what).toLowerCase()}`.slice(0, 140),
      stlName: null,
      thumbnailUrl: null,
      weightG: null,
      printTimeHrs: null,
      filamentCost: null,
      timeCost: null,
      totalCost: null,
      estimate: null,
      submittedAt: new Date().toISOString(),
    };

    try {
      await api.create(entry);
      api.notify(entry);
      fetch("/api/quote-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...turnstileHeaders() },
        keepalive: true,
        body: JSON.stringify(entry),
      }).catch(() => {});
      track("Quote submitted", { form: "clubs", quantity: entry.quantity, hasFiles: true });
      setSent(entry);
      setForm(EMPTY);
      setFiles([]);
      turnstile.reset();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="py-10 text-center">
        <CheckCircle2 size={48} className="mx-auto mb-4 text-flame" />
        <h3 className="text-2xl font-semibold">Request received</h3>
        <p className="mx-auto mt-2 max-w-sm leading-relaxed text-ink/65">
          Thanks {sent.name.split(" ")[0]}. I'll reply to <span className="font-medium text-ink">{sent.email}</span> within one
          business day with a proof and a price.
        </p>
        <p className="mt-3 font-mono text-xs text-ink/40">Ref {sent.id.slice(0, 8).toUpperCase()}</p>
        <button type="button" className="btn-outline-dark mt-6" onClick={() => setSent(null)}>
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <input className="field" value={form.name} onChange={set("name")} autoComplete="name" required />
        </Field>
        <Field label="Email" required>
          <input className="field" type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
        </Field>
      </div>
      <Field label="Club, team or shop" required>
        <input className="field" value={form.club} onChange={set("club")} required placeholder="e.g. North Shore Trail Sisters" />
      </Field>

      <Field label="Your logo" required hint="(PNG, SVG, AI, EPS or PDF)">
        <FileDrop files={files} onChange={setFiles} disabled={busy} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What for">
          <select className="field" value={form.what} onChange={set("what")}>
            {WHAT.map(([k, name]) => <option key={k} value={k}>{name}</option>)}
          </select>
        </Field>
        {form.what !== "plates" && (
          <Field label="Sticker type">
            <select className="field" value={form.kind} onChange={set("kind")}>
              {KINDS.map(([k, name]) => <option key={k} value={k}>{name}</option>)}
            </select>
          </Field>
        )}
        <Field label="How many">
          <select className="field" value={form.quantity} onChange={set("quantity")}>
            {QUANTITIES.map((q) => <option key={q}>{q}</option>)}
          </select>
        </Field>
        <Field label="Needed by" hint="(optional)">
          <input className="field" type="date" value={form.deadline} onChange={set("deadline")} />
        </Field>
      </div>

      <Field label="Anything else" hint="(optional)">
        <textarea
          className="field resize-y"
          rows={3}
          value={form.details}
          onChange={set("details")}
          placeholder="Sizes, colours, a race date, a mix of designs..."
        />
      </Field>

      <label className="flex items-start gap-3 rounded-xl bg-paper p-3 text-sm">
        <input type="checkbox" checked={form.allowed} onChange={set("allowed")} className="mt-0.5 h-4 w-4 flex-none accent-flame" />
        <span>
          <span className="font-semibold">This logo is ours, or we have permission to use it.</span>{" "}
          <span className="text-ink/60">I can't print other companies' logos, like bike or component brands, without their OK.</span>
        </span>
      </label>

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
          <span>
            {error}
            {site.email && (
              <> You can also email <a href={`mailto:${site.email}`} className="font-medium underline">{site.email}</a>.</>
            )}
          </span>
        </p>
      )}

      {turnstile.needed && <div ref={turnstile.box} />}
      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-70">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {progress || (busy ? "Sending…" : "Get a proof and price")}
      </button>
      <p className="text-center text-xs text-ink/50">No minimums. A reply within one business day, and a fixed price before anything prints.</p>
    </form>
  );
}
