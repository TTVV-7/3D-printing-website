import React from "react";
import ReactDOM from "react-dom/client";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Header } from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";
import { CookieBanner } from "../components/CookieBanner.jsx";
import { ConsentAnalytics } from "../components/ConsentAnalytics.jsx";
import { PriceChat } from "../components/PriceChat.jsx";
import { AccountPage } from "./AccountPage.jsx";
import "../index.css";

// The /account page: sign in, see your orders and sticker designs.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Header home="/" />
    <main>
      <AccountPage />
    </main>
    <Footer home="/" />
    <CookieBanner />
    <ConsentAnalytics />
    <PriceChat />
    <SpeedInsights />
  </React.StrictMode>,
);
