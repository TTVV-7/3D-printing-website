import { renderToString } from "react-dom/server";
import { App } from "./App.jsx";
import { Page as Stickers } from "./stickers/Page.jsx";
import { Page as Bike } from "./bike/Page.jsx";
import { Page as Models } from "./models/Page.jsx";

// Used only at build time by scripts/prerender.js: each page's HTML file
// (in dist/) and what to render into it.
export const pages = {
  "index.html": App,
  "stickers/index.html": Stickers,
  "bike/index.html": Bike,
  "models/index.html": Models,
};

export function render(file) {
  const Page = pages[file];
  return renderToString(<Page />);
}
