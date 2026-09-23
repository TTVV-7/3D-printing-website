// ---------------------------------------------------------------------------
// Everything customer-facing that you'll want to tweak lives here.
// Read by both the React app and the build (index.html meta, sitemap, SEO).
// ---------------------------------------------------------------------------

// Only the build (Node) sees env vars; the browser bundle never uses site.url.
function canonicalUrl() {
  const env = typeof process !== "undefined" ? process.env : {};
  if (env.SITE_URL) return env.SITE_URL;
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:5173";
}

export const site = {
  name: "MAP3D",
  tagline: "Custom 3D printing in Vancouver",
  description:
    "Vancouver 3D printing service for replacement parts, prototypes and small production runs. " +
    "Send an STL, a link or just a description and get a free quote within one business day.",
  city: "Vancouver",
  region: "BC",
  country: "CA",

  // Canonical address of the live site. Set SITE_URL in Vercel once you have a
  // domain; until then Vercel's production URL is used automatically.
  url: canonicalUrl(),

  // Public contact email shown in the footer. Leave empty to rely on the form.
  email: "",

  // Social profiles: shown in the footer and linked from search results
  // (schema.org sameAs). Empty entries are hidden.
  social: {
    instagram: "",
    tiktok: "",
    youtube: "https://www.youtube.com/watch?v=pHTwqG2WMGA",
    facebook: "",
    makerworld: "",
  },
};

// Printed in several places (schema.org FAQ, the FAQ section). Keep answers
// honest -- search engines show these verbatim.
export const faqs = [
  {
    q: "How much does a print cost?",
    a: "It depends on size, material and print time. Send the details and you'll get a fixed price before anything is printed. Quotes are free and there's no obligation.",
  },
  {
    q: "I don't have a 3D model. Can you still help?",
    a: "Yes. Send photos of the broken part, rough measurements or a sketch. I can model simple replacement parts and brackets from scratch, and design work is quoted up front.",
  },
  {
    q: "What file types do you accept?",
    a: "STL, 3MF, STEP, OBJ, or a link to MakerWorld, Printables or Thingiverse. Photos and PDFs work too for describing what you need.",
  },
  {
    q: "How fast can I get my part?",
    a: "Most jobs are ready in 3–5 days after you approve the quote. If you have a deadline, put it in the request and I'll tell you honestly whether it's doable.",
  },
  {
    q: "Do you do more than one copy?",
    a: "Yes. Small production runs of a few to a few hundred identical parts are a good fit, e.g. enclosures, fixtures, merch or replacement stock for a small business.",
  },
  {
    q: "Where are you and how do I get my part?",
    a: "I'm in Vancouver, BC. You can pick up locally or have it shipped.",
  },
];
