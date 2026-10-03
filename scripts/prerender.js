// Runs after `vite build` + the SSR build. Writes one real HTML file per
// route, with that page's <head> and its content already rendered, so search
// engines and link previews don't need to run JavaScript to read the site.
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { headFor, routes, robots, sitemap } from "../src/seo.js";
import { render } from "../dist-ssr/entry-server.js";

const template = readFileSync("dist/index.html", "utf8");

for (const route of routes) {
  const html = template
    .replace(/<!--head-->[\s\S]*?<!--\/head-->/, () => headFor(route))
    .replace("<!--app-->", () => render(route));
  // vercel.json has cleanUrls on, so dist/rapid-prototyping.html is served at /rapid-prototyping.
  const file = route === "/" ? "dist/index.html" : `dist${route}.html`;
  writeFileSync(file, html);
  console.log(`prerendered ${route} -> ${file}`);
}

writeFileSync("dist/robots.txt", robots());
writeFileSync("dist/sitemap.xml", sitemap());
rmSync("dist-ssr", { recursive: true, force: true });
