import { Header } from "./components/Header.jsx";
import { Hero } from "./components/Hero.jsx";
import { Services } from "./components/Services.jsx";
import { Designer } from "./components/Designer.jsx";
import { Materials } from "./components/Materials.jsx";
import { Work } from "./components/Work.jsx";
import { Process } from "./components/Process.jsx";
import { Faq } from "./components/Faq.jsx";
import { Quote } from "./components/Quote.jsx";
import { QuoteCta } from "./components/QuoteCta.jsx";
import { Footer } from "./components/Footer.jsx";
import { FloatingGolem } from "./components/FloatingGolem.jsx";
import { ServicePage } from "./components/ServicePage.jsx";
import { pageBySlug } from "./pages.js";

// Sections that also stand alone as their own page. Keep in sync with
// sitePages in src/seo.js.
const STANDALONE = { quote: Quote, work: Work, materials: Materials, faq: Faq };

// Every route is a separate pre-rendered HTML file; links between them are
// plain <a> tags, so there's no client-side router.
export function App({ path = "/" }) {
  const slug = path.replace(/^\/|\/$/g, "");
  const page = pageBySlug[slug];
  const Standalone = STANDALONE[slug];

  return (
    <>
      <Header solid={!!Standalone} />
      <main>
        {page ? (
          <ServicePage page={page} />
        ) : Standalone ? (
          <Standalone standalone />
        ) : (
          <>
            <Hero />
            <Services />
            <Designer />
            <Work />
            <Process />
            <QuoteCta />
          </>
        )}
      </main>
      <Footer />
      <FloatingGolem />
    </>
  );
}
