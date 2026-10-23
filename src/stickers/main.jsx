import React from "react";
import ReactDOM from "react-dom/client";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Header } from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";
import { CookieBanner } from "../components/CookieBanner.jsx";
import { ConsentAnalytics } from "../components/ConsentAnalytics.jsx";
import { PriceChat } from "../components/PriceChat.jsx";
import { StickerStudio } from "./StickerStudio.jsx";
import "../index.css";

// The /stickers page. Not prerendered: the whole page is the live preview.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Header home="/" />
    <main>
      <StickerStudio />
    </main>
    <Footer home="/" />
    <CookieBanner />
    <ConsentAnalytics />
    <PriceChat />
    <SpeedInsights />
  </React.StrictMode>,
);
