import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import { FileDrop } from "./FileDrop.jsx";
import { QuoteGolem } from "./QuoteGolem.jsx";
import { printRequests as api } from "../lib/api.js";
import { site } from "../../site.config.js";

const MATERIALS = [
  { value: "", label: "Not sure, recommend one" },
  { value: "PLA", label: "PLA: general purpose, best detail" },
  { value: "PETG", label: "PETG: tougher, water resistant" },
  { value: "Nylon", label: "Nylon: tough, high wear resistance" },
  { value: "TPU", label: "TPU: flexible" },
];

const QUALITIES = [
  { value: "", label: "Not sure, standard is fine" },
  { value: "Draft 0.28mm", label: "Draft: 0.28 mm, fastest" },
  { value: "Standard 0.20mm", label: "Standard: 0.20 mm" },
  { value: "Fine 0.12mm", label: "Fine: 0.12 mm, best finish" },
];

const EMPTY = {
  name: "", email: "", details: "", url: "",
  material: "", quality: "", quantity: "1", deadline: "", budget: "",
};

function Field({ label, required, hint, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink/75">
        {label}
        {required && <span className="text-flame"> *</span>}
        {hint && <span className="font-normal text-ink/40"> {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Submitted({ entry, onReset }) {
  return (
    <div className="py-10 text-center">
      <CheckCircle2 size={48} className="mx-auto mb-4 text-flame" />
      <h3 className="text-2xl font-semibold">Request received</h3>
      <p className="mx-auto mt-2 max-w-sm leading-relaxed text-ink/65">
        Thanks {entry.name.split(" ")[0]}. I'll reply to{" "}
        <span className="font-medium text-ink">{entry.email}</span> within one business day with
        a quote and a realistic turnaround.
      </p>
      <p className="mt-3 font-mono text-xs text-ink/40">Ref {entry.id.slice(0, 8).toUpperCase()}</p>
      <button type="button" className="btn-outline-dark mt-6" onClick={onReset}>
        Send another request
      </button>
    </div>
  );
}

function MaterialField({ value, onChange }) {
  return (
    <Field label="Material">
      <select className="field" value={value} onChange={onChange}>
        {MATERIALS.map((m) => <option key={m.label} value={m.value}>{m.label}</option>)}
      </select>
    </Field>
  );
}

function QuantityField({ value, onChange }) {
  return (
    <Field label="Quantity">
      <input className="field" type="number" min="1" value={value} onChange={onChange} />
    </Field>
  );
}

// The quote request form, shared by the Quote section and the Design your own
// section. `compact` swaps the optional extras (link, quality, date, budget)
// for just material and quantity. `titlePrefix` tags the request in the admin
// panel so you can tell where it came from. `golem` perches the crystal golem
// on the send button.
export function QuoteForm({
  compact = false,
  golem = false,
  detailsLabel = "Describe the part",
  detailsPlaceholder = "e.g. Replacement bracket for a shelf, about 8 cm wide, needs to hold ~2 kg.",
  filesHint = "(STL, 3MF, STEP, or a photo)",
  submitLabel = "Send my request",
  titlePrefix = "",
}) {
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState(null);
  // Phones get the four fields that matter; the rest opens on request.
  // Wider screens always show everything.
  const [more, setMore] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const uploaded = [];
    try {
      // ~100 KB of client SDK, only loaded when something is attached.
      const { upload } = files.length ? await import("@vercel/blob/client") : { upload: null };

      for (const [i, file] of files.entries()) {
        setProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);
        const blob = await upload(`requests/${id}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });
        uploaded.push({ name: file.name, size: file.size, url: blob.url });
      }
    } catch {
      setProgress(null);
      setSubmitting(false);
      setError(
        `Couldn't upload ${files[uploaded.length]?.name ?? "your files"}. ` +
          "You can remove the file and send the request with a link instead.",
      );
      return;
    }

    setProgress(null);

    // Same shape the store backend has always accepted.
    const entry = {
      id,
      mode: form.url.trim() ? "url" : "description",
      name: form.name.trim(),
      email: form.email.trim(),
      details: form.details.trim(),
      url: form.url.trim() || null,
      material: form.material || null,
      quality: form.quality || null,
      quantity: Number(form.quantity) || 1,
      deadline: form.deadline || null,
      budget: form.budget.trim() || null,
      files: uploaded,
      title: titlePrefix + (form.details.trim().slice(0, 120) || form.url.trim()),
      stlName: null,
      thumbnailUrl: null,
      weightG: null,
      printTimeHrs: null,
      filamentCost: null,
      timeCost: null,
      totalCost: null,
      submittedAt: new Date().toISOString(),
    };

    try {
      await api.create(entry);
      api.notify(entry);
      setSubmitted(entry);
      setForm(EMPTY);
      setFiles([]);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) return <Submitted entry={submitted} onReset={() => setSubmitted(null)} />;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <input className="field" value={form.name} onChange={set("name")} autoComplete="name" required />
        </Field>
        <Field label="Email" required>
          <input className="field" type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
        </Field>
      </div>

      <Field label={detailsLabel} required>
        <textarea
          className="field resize-y"
          rows={compact ? 3 : 4}
          value={form.details}
          onChange={set("details")}
          required
          placeholder={detailsPlaceholder}
        />
      </Field>

      <Field label="Files" hint={filesHint}>
        <FileDrop files={files} onChange={setFiles} disabled={submitting} />
      </Field>

      {compact ? (
        <div className="grid grid-cols-[1fr_7rem] gap-4">
          <MaterialField value={form.material} onChange={set("material")} />
          <QuantityField value={form.quantity} onChange={set("quantity")} />
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            aria-expanded={more}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-ink/15 px-3.5 py-2.5 text-left text-sm font-medium text-ink/70 sm:hidden"
          >
            More details (link, material, quantity, date)
            <ChevronDown size={16} className={clsx("transition-transform", more && "rotate-180")} />
          </button>

          <div className={clsx("space-y-4 sm:block", !more && "hidden")}>
            <Field label="Reference link" hint="(MakerWorld, Printables, Thingiverse…)">
              <input className="field" type="url" value={form.url} onChange={set("url")} placeholder="https://" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <MaterialField value={form.material} onChange={set("material")} />
              <Field label="Quality">
                <select className="field" value={form.quality} onChange={set("quality")}>
                  {QUALITIES.map((q) => <option key={q.label} value={q.value}>{q.label}</option>)}
                </select>
              </Field>
              <QuantityField value={form.quantity} onChange={set("quantity")} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Needed by" hint="(optional)">
                <input className="field" type="date" value={form.deadline} onChange={set("deadline")} />
              </Field>
              <Field label="Budget" hint="(optional)">
                <input className="field" value={form.budget} onChange={set("budget")} placeholder="e.g. under $40" />
              </Field>
            </div>
          </div>
        </>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
          <span>
            {error}
            {site.email && (
              <> You can also email <a href={`mailto:${site.email}`} className="font-medium underline">{site.email}</a> directly.</>
            )}
          </span>
        </p>
      )}

      {/* With the golem, leave room above the button for him to stand. */}
      <div className={clsx("relative", golem && "pt-14")}>
        {golem && <QuoteGolem />}
        <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
          {submitting ? (
            <><Loader2 size={18} className="animate-spin" /> {progress || "Sending…"}</>
          ) : (
            <>{submitLabel} <ArrowRight size={18} /></>
          )}
        </button>
      </div>
      <p className="text-center text-xs text-ink/45">
        Your details are only used to reply to this request.
      </p>
    </form>
  );
}
