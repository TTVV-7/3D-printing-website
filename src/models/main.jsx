import React from "react";
import ReactDOM from "react-dom/client";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Header } from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";
import { CookieBanner } from "../components/CookieBanner.jsx";
import { ConsentAnalytics } from "../components/ConsentAnalytics.jsx";
import { PriceChat } from "../components/PriceChat.jsx";
import { ModelsPage } from "./ModelsPage.jsx";
import "../index.css";

// The /models page: original 3D models to view and have printed.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Header home="/" />
    <main>
      <ModelsPage />
    </main>
    <Footer home="/" />
    <CookieBanner />
    <ConsentAnalytics />
    <PriceChat />
    <SpeedInsights />
  </React.StrictMode>,
);
