import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.jsx";
import "./index.css";

const root = document.getElementById("root");
const app = (
  <React.StrictMode>
    <App path={window.location.pathname} />
  </React.StrictMode>
);

// Built pages arrive pre-rendered (scripts/prerender.js); the dev server's don't.
if (root.firstElementChild) ReactDOM.hydrateRoot(root, app);
else ReactDOM.createRoot(root).render(app);
