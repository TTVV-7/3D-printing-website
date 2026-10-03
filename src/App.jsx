import { Header } from "./components/Header.jsx";
import { Hero } from "./components/Hero.jsx";
import { Services } from "./components/Services.jsx";
import { Designer } from "./components/Designer.jsx";
import { Materials } from "./components/Materials.jsx";
import { Work } from "./components/Work.jsx";
import { Process } from "./components/Process.jsx";
import { Faq } from "./components/Faq.jsx";
import { Quote } from "./components/Quote.jsx";
import { Footer } from "./components/Footer.jsx";
import { FloatingGolem } from "./components/FloatingGolem.jsx";
import { ServicePage } from "./components/ServicePage.jsx";
import { pageBySlug } from "./pages.js";

// Each service page is a separate pre-rendered HTML file; links between them
// are plain <a> tags, so there's no client-side router.
export function App({ path = "/" }) {
  const page = pageBySlug[path.replace(/^\/|\/$/g, "")];

  return (
    <>
      <Header />
      <main>
        {page ? (
          <ServicePage page={page} />
        ) : (
          <>
            <Hero />
            <Services />
            <Designer />
            <Materials />
            <Work />
            <Process />
            <Faq />
            <Quote />
          </>
        )}
      </main>
      <Footer />
      <FloatingGolem />
    </>
  );
}
