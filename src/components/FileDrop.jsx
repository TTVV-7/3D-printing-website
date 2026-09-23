import { useRef, useState } from "react";
import { UploadCloud, File as FileIcon, X, AlertCircle } from "lucide-react";
import { clsx } from "clsx";

// Matches the limits enforced by the backend's /api/upload route.
export const ACCEPTED = [
  ".stl", ".3mf", ".obj", ".step", ".stp", ".gcode", ".zip",
  ".jpg", ".jpeg", ".png", ".heic", ".pdf",
];
export const MAX_FILE_MB = 25;
export const MAX_FILES = 5;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function extensionOf(name) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export function FileDrop({ files, onChange, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState([]);

  function accept(incoming) {
    const problems = [];
    const next = [...files];

    for (const file of incoming) {
      if (next.length >= MAX_FILES) {
        problems.push(`${file.name}: limit is ${MAX_FILES} files`);
        continue;
      }
      if (!ACCEPTED.includes(extensionOf(file.name))) {
        problems.push(`${file.name}: unsupported file type`);
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        problems.push(`${file.name}: over ${MAX_FILE_MB} MB`);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      next.push(file);
    }

    setRejected(problems);
    onChange(next);
  }

  const open = () => !disabled && inputRef.current?.click();

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) accept(Array.from(e.dataTransfer.files || []));
        }}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
        }}
        role="button"
        tabIndex={0}
        className={clsx(
          "rounded-2xl border-2 border-dashed px-4 py-7 text-center cursor-pointer transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame",
          dragging ? "border-flame bg-flame-100/60" : "border-ink/15 bg-paper/60 hover:border-flame/60",
          disabled && "opacity-50 pointer-events-none",
        )}
      >
        <UploadCloud size={22} className={clsx("mx-auto mb-2", dragging ? "text-flame" : "text-ink/40")} />
        <p className="text-sm text-ink/70">
          <span className="font-medium text-flame">Choose files</span> or drag them here
        </p>
        <p className="mt-1 text-xs text-ink/45">
          STL, 3MF, STEP, OBJ, ZIP or photos · up to {MAX_FILE_MB} MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => { accept(Array.from(e.target.files || [])); e.target.value = ""; }}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`} className="flex items-center gap-2.5 rounded-xl border border-ink/10 bg-white px-3 py-2">
              <FileIcon size={14} className="flex-shrink-0 text-flame" />
              <span className="flex-1 truncate text-sm">{file.name}</span>
              <span className="flex-shrink-0 text-xs text-ink/45">{formatSize(file.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((f) => f !== file))}
                className="flex-shrink-0 text-ink/30 hover:text-red-500"
                aria-label={`Remove ${file.name}`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {rejected.length > 0 && (
        <ul className="space-y-1">
          {rejected.map((p) => (
            <li key={p} className="flex items-start gap-1.5 text-xs text-amber-700">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" /> {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
