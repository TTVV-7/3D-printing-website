// ---------------------------------------------------------------------------
// Everything customer-facing that you'll want to tweak lives here.
// Read by both the React app and the build (index.html meta, sitemap, SEO).
// ---------------------------------------------------------------------------

// Only the build (Node) sees env vars; the browser bundle never uses site.url.
function canonicalUrl() {
  const env = typeof process !== "undefined" ? process.env : {};
  if (env.SITE_URL) return env.SITE_URL;
  return "https://printyours.ca";
}

export const site = {
  name: "Print Yours",
  tagline: "Custom 3D printing in Vancouver",
  description:
    "Vancouver 3D printing service for replacement parts, prototypes and small production runs. " +
    "Send an STL, a link or just a description and get a free quote within one business day.",
  city: "Vancouver",
  region: "BC",
  country: "CA",

  // Canonical address of the live site. SITE_URL overrides it (e.g. to test
  // link previews on a staging domain).
  url: canonicalUrl(),

  // The live generator app (3D-print-sandbox repo). Linked from "Design your own".
  designerUrl: "https://design.printyours.ca",

  // Public contact email: shown in the footer, beside the quote form and in the
  // no-JavaScript fallback. Leave empty to rely on the form.
  email: "thomas.verigin@gmail.com",

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

// Prices shown in the "Services & pricing" section. All CAD, before tax.
// DRAFT numbers -- adjust to taste; the page reads straight from here.
export const pricing = {
  services: [
    {
      key: "print",
      title: "Print from your file",
      price: "from $15",
      unit: "per order",
      body: "You have an STL, 3MF or a MakerWorld / Printables link. I check it, pick settings and print it.",
      includes: ["Most small parts land between $15 and $40", "Priced by material and print time", "Free reprint if it's not right"],
    },
    {
      key: "design",
      title: "Custom design",
      price: "$50",
      unit: "per design",
      body: "No model? Send photos, measurements or the broken part and I'll model it in CAD. Printing is priced separately.",
      includes: ["One test print and one round of fit tweaks", "You keep the file", "Extra revisions $65/hr"],
      featured: true,
    },
    {
      key: "batch",
      title: "Small batches",
      price: "10–20% off",
      unit: "per part",
      body: "A handful to a few hundred identical parts, printed consistently. Good for small businesses and short runs.",
      includes: ["10+ copies: 10% off", "50+ copies: 20% off", "Larger runs quoted individually"],
    },
  ],

  extras: [
    "Rush (under 48 h): +50%",
    "Local pickup in Vancouver: free",
    "Shipping: at cost",
  ],
};

// Instant estimate shown when someone drops an STL or 3MF in the quote form.
// It's a ballpark only: every request still lands in the admin panel for you
// to review and price. DRAFT numbers -- tune them against a few real slices.
export const estimate = {
  // Per material: density (g/cm³) and what you charge per gram of filament.
  materials: {
    PLA: { density: 1.24, perGram: 0.08 },
    PETG: { density: 1.27, perGram: 0.09 },
    Nylon: { density: 1.08, perGram: 0.2 },
    TPU: { density: 1.21, perGram: 0.15 },
  },
  defaultMaterial: "PLA",
  // Roughly how many grams per hour the printer lays down at each quality.
  // Keys match the Quality options in the quote form ("" = not sure).
  gramsPerHour: {
    "": 28,
    "Draft 0.28mm": 40,
    "Standard 0.20mm": 28,
    "Fine 0.12mm": 16,
    "Extra fine 0.08mm": 10,
    // Varies with the model; somewhere between standard and fine on average.
    Adaptive: 22,
  },
  machinePerHour: 3, // $ per hour of print time
  setupPerPart: 5, // $ per distinct file: checking, slicing, plate removal
  orderMinimum: 15, // $ -- matches "from $15" in Services
  // Slicer assumptions: solid skin this thick (mm) plus this infill inside,
  // plus a bit extra for supports and purge.
  wallMm: 0.9,
  infill: 0.15,
  waste: 1.1,
  // Range shown to the customer around the middle estimate.
  low: 0.8,
  high: 1.25,
  // Same breaks as the Small batches card.
  bulk: [
    { min: 50, off: 0.2 },
    { min: 10, off: 0.1 },
  ],
  // Bambu X1C / P1S build plate (mm). Bigger parts are flagged.
  maxSizeMm: 256,
};

// Customer reviews. The section stays hidden until there's at least one
// review or one link. Copy reviews word-for-word from where they were left
// and only post ones you have permission to share -- first name + initial is plenty.
export const reviews = {
  // Your Facebook Marketplace seller profile (Marketplace → your profile → Share → Copy link).
  marketplaceUrl: "",
  // Your Google Business Profile review link, once you have one.
  googleUrl: "",
  items: [
    // { name: "Sarah K.", rating: 5, text: "Printed a replacement dishwasher clip in two days. Fits perfectly.", source: "Facebook Marketplace" },
  ],
};
