import { useState } from "react";
import { clsx } from "clsx";
import { FONTS } from "./fonts.js";

// The typeface buttons, each in its own face. The extra ones (fonts.js
// `more`) wait behind "More fonts", so their files only load when asked for.
export function FontPicker({ value, onPick, small = false }) {
  const [all, setAll] = useState(() => !!FONTS.find((f) => f.family === value)?.more);
  const shown = FONTS.filter((f) => all || !f.more);
  return (
    <div className={clsx("flex flex-wrap", small ? "gap-1.5" : "gap-2")}>
      {shown.map((f) => (
        <button
          key={f.family}
          type="button"
          onClick={() => onPick(f)}
          aria-pressed={value === f.family}
          className={clsx(
            "rounded-lg ring-1 transition",
            small ? "px-2.5 py-1 text-sm" : "px-3 py-1.5 text-base",
            value === f.family ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40",
          )}
          style={{ fontFamily: `"${f.family}"`, fontWeight: f.weight }}
        >
          {f.name}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setAll((a) => !a)}
        className={clsx("rounded-lg font-medium text-flame-600 underline-offset-2 hover:underline", small ? "px-2 py-1 text-sm" : "px-2 py-1.5 text-sm")}
      >
        {all ? "Fewer fonts" : `More fonts (${FONTS.filter((f) => f.more).length})`}
      </button>
    </div>
  );
}
