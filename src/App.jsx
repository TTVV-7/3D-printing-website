import { Header } from "./components/Header.jsx";
import { Hero } from "./components/Hero.jsx";
import { Services } from "./components/Services.jsx";
import { Designer } from "./components/Designer.jsx";
import { Materials } from "./components/Materials.jsx";
import { Work } from "./components/Work.jsx";
import { Faq } from "./components/Faq.jsx";
import { Quote } from "./components/Quote.jsx";
import { Footer } from "./components/Footer.jsx";
import { FloatingGolem } from "./components/FloatingGolem.jsx";
import { Analytics } from "@vercel/analytics/react";

export function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Services />
        <Designer />
        <Materials />
        <Work />
        <Faq />
        <Quote />
      </main>
      <Footer />
      <FloatingGolem />
      <Analytics />
    </>
  );
}
