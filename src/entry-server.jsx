import { renderToString } from "react-dom/server";
import { App } from "./App.jsx";

// Used only at build time by scripts/prerender.js.
export function render() {
  return renderToString(<App />);
}
