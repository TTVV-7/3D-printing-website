import React from "react";
import ReactDOM from "react-dom/client";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Page } from "./Page.jsx";
import "../index.css";

// Prerendered at build time (scripts/prerender.js); in dev it's empty, so
// render normally.
const root = document.getElementById("root");
const page = (
  <React.StrictMode>
    <Page />
    <SpeedInsights />
  </React.StrictMode>
);

if (root.hasChildNodes()) ReactDOM.hydrateRoot(root, page);
else ReactDOM.createRoot(root).render(page);
