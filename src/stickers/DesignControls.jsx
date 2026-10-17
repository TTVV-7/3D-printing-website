import { useEffect, useRef, useState } from "react";
import { Dices } from "lucide-react";
import { clsx } from "clsx";
import { stickers } from "../../site.config.js";
import { CROPS, DESIGNS, RING_GROUPS, drawDesign, drawEdgeRing, maskPath, loadDesignImages } from "./library.js";

// Size, cut shape, background design and edge ring: the options from the
// in-shop Sticker Printer app.

const newSeed = () => Math.floor(Math.random() * 1e9);
// Shapes that come out different every time: these get a 🎲.
const SEEDED = new Set(["star", "pebble", "scallop", "burst"]);
const SIZE_GROUPS = [...new Set(stickers.sizes.map((s) => s.group))];
const ALL_RINGS = RING_GROUPS.flatMap(([, rings]) => rings.map(([k]) => k));

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

function ShapeIcon({ crop, seed }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const g = c.getContext("2d");
    g.clearRect(0, 0, 40, 40);
    g.fillStyle = "currentColor";
    g.fillStyle = getComputedStyle(c).color;
    if (crop === "none") {
      g.beginPath();
      g.roundRect(5, 9, 30, 22, 3);
      g.fill();
    } else g.fill(maskPath(crop, 40, 40, seed));
  }, [crop, seed]);
  return <canvas ref={ref} width={40} height={40} className="h-6 w-6" />;
}

export function DesignControls({ d, set }) {
  const size = stickers.sizes.find((s) => s.key === d.sizeKey);
  // Repaint the logo designs once their artwork has downloaded.
  const [art, setArt] = useState(0);
  const [patternsOpen, setPatternsOpen] = useState(d.pattern !== "none");
  useEffect(() => loadDesignImages("/stickers/designs", () => setArt((n) => n + 1)), []);

  return (
    <>
      <div>
        <Label hint={`${size.w} × ${size.h} mm`}>Label size</Label>
        <select
          className="field"
          value={d.sizeKey}
          onChange={(e) => {
            const next = stickers.sizes.find((s) => s.key === e.target.value);
            set({ sizeKey: next.key, ...(next.crop ? { crop: next.crop } : size.crop ? { crop: "none" } : {}) });
          }}
        >
          {SIZE_GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {stickers.sizes
                .filter((s) => s.group === g)
                .map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <Label>Shape</Label>
        <div className="flex gap-2">
          <div className="grid flex-1 grid-cols-4 gap-2 sm:grid-cols-8">
            {[["none", "Label"], ...CROPS].map(([key, name]) => (
              <button
                key={key}
                type="button"
                onClick={() => set({ crop: key })}
                aria-pressed={d.crop === key}
                title={name}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium ring-1 transition",
                  d.crop === key ? "bg-ink text-white ring-ink" : "bg-white text-ink ring-ink/15 hover:ring-ink/40",
                )}
              >
                <ShapeIcon crop={key} seed={d.cropSeed} />
                <span className="truncate">{name.split(" /")[0].replace(" badge", "")}</span>
              </button>
            ))}
          </div>
          {SEEDED.has(d.crop) && <DiceButton label="New variation of this shape" onClick={() => set({ cropSeed: newSeed() })} />}
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

      <div>
        <Label>Edge ring</Label>
        <div className="flex gap-2">
          <select className="field" value={d.ring} onChange={(e) => set({ ring: e.target.value })}>
            <option value="none">None</option>
            {RING_GROUPS.map(([group, rings]) => (
              <optgroup key={group} label={group}>
                {rings.map(([k, name]) => (
                  <option key={k} value={k}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {d.ring !== "none" && (
            <Thumb
              className="h-10 w-10 flex-none rounded-xl ring-1 ring-ink/15"
              deps={[d.ring]}
              draw={(g, w, h) => drawEdgeRing(g, w, h, d.ring, null)}
            />
          )}
          <DiceButton
            label="Random edge ring"
            onClick={() => set({ ring: ALL_RINGS[Math.floor(Math.random() * ALL_RINGS.length)] })}
          />
        </div>
      </div>
    </>
  );
}
