// Bakes each rendered page into its dist/ HTML file so search engines and
// link previews see the real content instead of an empty <div id="root">.
// The browser then hydrates it (see src/main.jsx and src/*/main.jsx).
import { readFile, writeFile, rm } from "node:fs/promises";

const { pages, render } = await import("../dist-ssr/entry-server.js");

for (const name of Object.keys(pages)) {
  const file = new URL(`../dist/${name}`, import.meta.url);
  const html = await readFile(file, "utf8");
  await writeFile(file, html.replace('<div id="root"></div>', `<div id="root">${render(name)}</div>`));
  console.log(`prerendered dist/${name}`);
}
await rm(new URL("../dist-ssr", import.meta.url), { recursive: true, force: true });
