import { Header } from "../components/Header.jsx";
import { Footer } from "../components/Footer.jsx";
import { CookieBanner } from "../components/CookieBanner.jsx";
import { ConsentAnalytics } from "../components/ConsentAnalytics.jsx";
import { PriceChat } from "../components/PriceChat.jsx";
import { StickerStudio } from "./StickerStudio.jsx";

// The /stickers page: thermal and full-colour sticker makers with a live preview.
// Rendered in the browser by main.jsx and at build time by
// scripts/prerender.js, so search engines get the page's text.
export function Page() {
  return (
    <>
      <Header home="/" />
      <main>
        <StickerStudio />
      </main>
      <Footer home="/" />
      <CookieBanner />
      <ConsentAnalytics />
      <PriceChat />
    </>
  );
}
