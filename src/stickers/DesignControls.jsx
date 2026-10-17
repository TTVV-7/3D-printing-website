import { useEffect, useRef, useState } from "react";
import { Dices } from "lucide-react";
import { clsx } from "clsx";
import { stickers } from "../../site.config.js";
import { DESIGNS, RING_GROUPS, drawDesign, drawEdgeRing, loadDesignImages } from "./library.js";

// Label size, background design and edge ring: the options from the in-shop
// Sticker Printer app. There's no cutting, so a sticker is the shape of its
// label: round labels are round, the rest rectangles.

const newSeed = () => Math.floor(Math.random() * 1e9);
const SIZE_GROUPS = [...new Set(stickers.sizes.map((s) => s.group))];
const ALL_RINGS = RING_GROUPS.flatMap(([, rings]) => rings.map(([k]) => k));
const ringGroupOf = (key) => RING_GROUPS.find(([, rings]) => rings.some(([k]) => k === key))?.[0];
// Size tiles are drawn to one scale, so they read as relative sizes.
const BIGGEST = Math.max(...stickers.sizes.flatMap((s) => [s.w, s.h]));

function Label({ children, hint }) {
  return (
    <p className="mb-2 flex items-baseline justify-between text-sm font-semibold">
      {children}
      {hint && <span className="font-normal text-ink/50">{hint}</span>}
    </p>
  );
}

function DiceButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white ring-1 ring-ink/15 hover:ring-ink/40"
    >
      <Dices size={18} />
    </button>
  );
}

// A small picture of a shape, design or ring. Drawn big and shown small,
// since the drawings are tuned for print-size canvases.
function Thumb({ draw, deps, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    draw(g, c.width, c.height);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} width={320} height={320} className={className} />;
}

// A label drawn to scale, with its name under it.
function SizeTile({ s, active, onClick }) {
  const k = 44 / BIGGEST; // px per mm
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "flex flex-col items-center justify-end gap-1.5 rounded-xl px-1 pb-2 pt-3 ring-1 transition",
        active ? "bg-ink text-white ring-ink" : "bg-white text-ink ring-ink/15 hover:ring-ink/40",
      )}
    >
      <span
        className={clsx("border-2", s.crop === "circle" ? "rounded-full" : "rounded-[3px]", active ? "border-flame bg-white/10" : "border-ink/60 bg-paper")}
        style={{ width: s.w * k, height: s.h * k }}
      />
      <span className="text-[11px] font-semibold leading-tight">{s.name}</span>
      {!s.name.endsWith("mm") && (
        <span className={clsx("text-[10px] leading-tight", active ? "text-white/60" : "text-ink/45")}>
          {s.w} × {s.h} mm
        </span>
      )}
    </button>
  );
}

export function DesignControls({ d, set }) {
  const size = stickers.sizes.find((s) => s.key === d.sizeKey);
  // Repaint the logo designs once their artwork has downloaded.
  const [art, setArt] = useState(0);
  const [patternsOpen, setPatternsOpen] = useState(d.pattern !== "none");
  const [ringsOpen, setRingsOpen] = useState(d.ring !== "none");
  const [ringGroup, setRingGroup] = useState(ringGroupOf(d.ring) || RING_GROUPS[0][0]);
  useEffect(() => loadDesignImages("/stickers/designs", () => setArt((n) => n + 1)), []);

  return (
    <>
      <div>
        <Label hint={size.crop === "circle" ? "round label" : "die-cut label"}>Label size</Label>
        <div className="space-y-3">
          {SIZE_GROUPS.map((g) => (
            <div key={g}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink/45">{g}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {stickers.sizes
                  .filter((s) => s.group === g)
                  .map((s) => (
                    <SizeTile
                      key={s.key}
                      s={s}
                      active={d.sizeKey === s.key}
                      // Rings are circles: they only suit round and square labels.
                      onClick={() => set({ sizeKey: s.key, ...(s.w !== s.h && { ring: "none" }) })}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <details
        className="rounded-2xl bg-white p-4 ring-1 ring-ink/10"
        open={patternsOpen}
        onToggle={(e) => setPatternsOpen(e.currentTarget.open)}
      >
        <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold">
          Background design
          <span className="font-normal text-ink/50">
            {d.pattern === "none" ? "None" : DESIGNS.find(([k]) => k === d.pattern)?.[1]}
          </span>
        </summary>
        {patternsOpen && (
        <div className="mt-4 flex items-start gap-2">
          <div className="grid flex-1 grid-cols-5 gap-2 sm:grid-cols-6">
            {[["none", "None"], ...DESIGNS].map(([key, name]) => (
              <button
                key={key}
                type="button"
                onClick={() => set({ pattern: key })}
                aria-pressed={d.pattern === key}
                title={name}
                className={clsx(
                  "aspect-square overflow-hidden rounded-lg ring-2 transition",
                  d.pattern === key ? "ring-flame" : "ring-ink/10 hover:ring-ink/30",
                )}
              >
                {key === "none" ? (
                  <span className="flex h-full items-center justify-center text-[11px] text-ink/50">None</span>
                ) : (
                  <Thumb
                    className="h-full w-full"
                    deps={[key, d.patternSeed, art]}
                    draw={(g, w, h) => drawDesign(g, w, h, key, d.patternSeed, null)}
                  />
                )}
                <span className="sr-only">{name}</span>
              </button>
            ))}
          </div>
          {d.pattern !== "none" && <DiceButton label="New random design" onClick={() => set({ patternSeed: newSeed() })} />}
        </div>
        )}
        {d.pattern !== "none" && (
          <p className="mt-3 text-xs text-ink/55">
            Text you add can be filled with the design or cut out of it: pick in the editor.
          </p>
        )}
      </details>

      {size.w !== size.h ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-ink/55 ring-1 ring-ink/10">
          <span className="font-semibold text-ink">Edge ring</span> · rings fit round and square labels.
        </p>
      ) : (
      <details
        className="rounded-2xl bg-white p-4 ring-1 ring-ink/10"
        open={ringsOpen}
        onToggle={(e) => setRingsOpen(e.currentTarget.open)}
      >
        <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold">
          Edge ring
          <span className="font-normal text-ink/50">
            {d.ring === "none" ? "None" : RING_GROUPS.flatMap(([, r]) => r).find(([k]) => k === d.ring)?.[1]}
          </span>
        </summary>
        {ringsOpen && (
          <div className="mt-4">
            <div className="flex gap-2">
              <div className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                {RING_GROUPS.map(([g]) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setRingGroup(g)}
                    aria-pressed={ringGroup === g}
                    className={clsx(
                      "flex-none whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                      ringGroup === g ? "bg-ink text-white ring-ink" : "bg-white ring-ink/15 hover:ring-ink/40",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <DiceButton
                label="Random edge ring"
                onClick={() => {
                  const key = ALL_RINGS[Math.floor(Math.random() * ALL_RINGS.length)];
                  set({ ring: key });
                  setRingGroup(ringGroupOf(key));
                }}
              />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {[["none", "None"], ...RING_GROUPS.find(([g]) => g === ringGroup)[1]].map(([key, name]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set({ ring: key })}
                  aria-pressed={d.ring === key}
                  className={clsx(
                    "flex flex-col items-center gap-1 rounded-xl p-1.5 ring-1 transition",
                    d.ring === key ? "bg-flame-100 ring-2 ring-flame" : "bg-white ring-ink/10 hover:ring-ink/30",
                  )}
                >
                  {key === "none" ? (
                    <span className="flex aspect-square w-full items-center justify-center rounded-full border-2 border-dashed border-ink/15 text-[11px] text-ink/40">
                      None
                    </span>
                  ) : (
                    <Thumb className="aspect-square w-full" deps={[key]} draw={(g, w, h) => drawEdgeRing(g, w, h, key, null)} />
                  )}
                  <span className="w-full truncate text-center text-[10px] leading-tight">{name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </details>
      )}
    </>
  );
}
