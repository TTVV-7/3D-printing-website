import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Clock, BadgeCheck, MessageCircle, Mail } from "lucide-react";
import { FileDrop } from "./FileDrop.jsx";
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

const PROMISES = [
  { icon: Clock, text: "Reply within one business day" },
  { icon: BadgeCheck, text: "Fixed price before anything prints" },
  { icon: MessageCircle, text: "Real person, no account, no spam" },
];

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

export function Quote() {
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState(null);

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
      title: form.details.trim().slice(0, 120) || form.url.trim(),
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

  return (
    <section id="quote" className="bg-paper-dark py-20 sm:py-28 layer-lines-dark">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div>
          <p className="eyebrow">Free quote</p>
          <h2 className="mt-3 text-4xl font-bold sm:text-5xl">What do you need printed?</h2>
          <p className="mt-4 text-lg text-ink/65">
            The more detail the better, but a rough description is enough to get started.
          </p>
          <ul className="mt-8 space-y-4">
            {PROMISES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 font-medium">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-flame">
                  <Icon size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
          {site.email && (
            <p className="mt-8 flex items-start gap-3 text-ink/65">
              <Mail size={18} className="mt-1 flex-shrink-0 text-flame" />
              <span>
                Form not working, or rather email? Send your files and details to{" "}
                <a href={`mailto:${site.email}`} className="font-medium text-ink underline decoration-flame underline-offset-4 hover:text-flame">
                  {site.email}
                </a>
              </span>
            </p>
          )}
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl shadow-ink/5 ring-1 ring-ink/5 sm:p-8">
          {submitted ? (
            <Submitted entry={submitted} onReset={() => setSubmitted(null)} />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" required>
                  <input className="field" value={form.name} onChange={set("name")} autoComplete="name" required />
                </Field>
                <Field label="Email" required>
                  <input className="field" type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
                </Field>
              </div>

              <Field label="Describe the part" required>
                <textarea
                  className="field resize-y"
                  rows={4}
                  value={form.details}
                  onChange={set("details")}
                  required
                  placeholder="e.g. Replacement bracket for a shelf, about 8 cm wide, needs to hold ~2 kg."
                />
              </Field>

              <Field label="Reference link" hint="(MakerWorld, Printables, Thingiverse…)">
                <input className="field" type="url" value={form.url} onChange={set("url")} placeholder="https://" />
              </Field>

              <Field label="Files" hint="(STL, 3MF, STEP, or a photo)">
                <FileDrop files={files} onChange={setFiles} disabled={submitting} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Material">
                  <select className="field" value={form.material} onChange={set("material")}>
                    {MATERIALS.map((m) => <option key={m.label} value={m.value}>{m.label}</option>)}
                  </select>
                </Field>
                <Field label="Quality">
                  <select className="field" value={form.quality} onChange={set("quality")}>
                    {QUALITIES.map((q) => <option key={q.label} value={q.value}>{q.label}</option>)}
                  </select>
                </Field>
                <Field label="Quantity">
                  <input className="field" type="number" min="1" value={form.quantity} onChange={set("quantity")} />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Needed by" hint="(optional)">
                  <input className="field" type="date" value={form.deadline} onChange={set("deadline")} />
                </Field>
                <Field label="Budget" hint="(optional)">
                  <input className="field" value={form.budget} onChange={set("budget")} placeholder="e.g. under $40" />
                </Field>
              </div>

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

              <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
                {submitting ? (
                  <><Loader2 size={18} className="animate-spin" /> {progress || "Sending…"}</>
                ) : (
                  <>Send my request <ArrowRight size={18} /></>
                )}
              </button>
              <p className="text-center text-xs text-ink/45">
                Your details are only used to reply to this request.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
