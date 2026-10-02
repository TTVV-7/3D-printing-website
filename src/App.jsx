import { Header } from "./components/Header.jsx";
import { Intro } from "./components/Intro.jsx";
import { Hero } from "./components/Hero.jsx";
import { Services } from "./components/Services.jsx";
import { Designer } from "./components/Designer.jsx";
import { Materials } from "./components/Materials.jsx";
import { Work } from "./components/Work.jsx";
import { Reviews } from "./components/Reviews.jsx";
import { Quote } from "./components/Quote.jsx";
import { Footer } from "./components/Footer.jsx";

export function App() {
  return (
    <>
      <Header />
      <main>
        <Intro />
        <Hero />
        <Designer />
        <Services />
        <Work />
        <Materials />
        <Reviews />
        <Quote />
      </main>
      <Footer />
    </>
  );
}
