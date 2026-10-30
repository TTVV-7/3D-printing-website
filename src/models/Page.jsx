import { Header } from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";
import { CookieBanner } from "../components/CookieBanner.jsx";
import { ConsentAnalytics } from "../components/ConsentAnalytics.jsx";
import { PriceChat } from "../components/PriceChat.jsx";
import { ModelsPage } from "./ModelsPage.jsx";

// The /models page: original 3D models to view and have printed.
// Rendered in the browser by main.jsx and at build time by
// scripts/prerender.js, so search engines get the page's text.
export function Page() {
  return (
    <>
      <Header home="/" />
      <main>
        <ModelsPage />
      </main>
      <Footer home="/" />
      <CookieBanner />
      <ConsentAnalytics />
      <PriceChat />
    </>
  );
}
