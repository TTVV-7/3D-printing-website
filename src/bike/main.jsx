import React from "react";
import ReactDOM from "react-dom/client";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Header } from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";
import { CookieBanner } from "../components/CookieBanner.jsx";
import { ConsentAnalytics } from "../components/ConsentAnalytics.jsx";
import { BikePage } from "./BikePage.jsx";
import "../index.css";

// The /bike page: bike sticker templates and club and team orders.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Header home="/" />
    <main>
      <BikePage />
    </main>
    <Footer home="/" />
    <CookieBanner />
    <ConsentAnalytics />
    <SpeedInsights />
  </React.StrictMode>,
);
