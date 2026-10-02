// Bakes the rendered page into dist/index.html so search engines and link
// previews see the real content instead of an empty <div id="root">.
// The browser then hydrates it (see src/main.jsx).
import { readFile, writeFile, rm } from "node:fs/promises";

const { render } = await import("../dist-ssr/entry-server.js");
const file = new URL("../dist/index.html", import.meta.url);

const html = await readFile(file, "utf8");
await writeFile(file, html.replace('<div id="root"></div>', `<div id="root">${render()}</div>`));
await rm(new URL("../dist-ssr", import.meta.url), { recursive: true, force: true });

console.log("prerendered dist/index.html");
