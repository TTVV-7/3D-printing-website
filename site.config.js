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
      price: "from $60",
      unit: "fixed price",
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

  // Fixed design prices. Most "simple" replacement parts are really standard:
  // measuring, a test print and a fit tweak add up.
  designTiers: [
    { name: "Simple", price: "$60", examples: "Spacers, knobs, plates, basic brackets, anything from clear dimensions" },
    { name: "Standard", price: "$120", examples: "Clips and snap fits, parts copied from a broken original, anything that has to fit something else" },
    { name: "Complex", price: "from $200", examples: "Hinges, threads, multi-part assemblies, enclosures, organic shapes" },
  ],

  extras: [
    "Rush (under 48 h): +50%",
    "Local pickup in Vancouver: free",
    "Shipping: at cost",
  ],
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

// The sticker shop (/stickers). Thermal printing on a Nelko PL70E-BT: one
// ink, black, on whatever label stock is loaded. DRAFT numbers -- adjust to taste.
export const stickers = {
  // Die-cut label stock for the Nelko PL70E-BT, from the in-shop Sticker
  // Printer app's size list (TTVV-7/Stickers). `code` is the printer's
  // PageSize; `crop` is the shape a round label starts with.
  sizes: [
    // Rounds: the usual direct-thermal sizes sold for 4" label printers. Only
    // 2" is in the app's size list yet; the others print on custom page
    // sizes (points = inches x 72).
    { key: "round-1in", group: "Round", name: '1" round', w: 25.4, h: 25.4, code: "w72h72", crop: "circle" },
    { key: "round-1.5in", group: "Round", name: '1.5" round', w: 38.1, h: 38.1, code: "w108h108", crop: "circle" },
    { key: "round-2in", group: "Round", name: '2" round', w: 50.8, h: 50.8, code: "w144h144", crop: "circle" },
    { key: "round-2.5in", group: "Round", name: '2.5" round', w: 63.5, h: 63.5, code: "w180h180", crop: "circle" },
    { key: "round-3in", group: "Round", name: '3" round', w: 76.2, h: 76.2, code: "w216h216", crop: "circle" },
    { key: "sq-50", group: "Square", name: "50 × 50 mm", w: 50, h: 50, code: "w141h141" },
    { key: "sq-2in", group: "Square", name: '2" square', w: 50.8, h: 50.8, code: "w144h144" },
    { key: "sq-53", group: "Square", name: "53 × 53 mm", w: 53, h: 53, code: "w150h150" },
    { key: "sq-3in", group: "Square", name: '3" square', w: 76.2, h: 76.2, code: "w216h216" },
    { key: "sq-4in", group: "Square", name: '4" square', w: 101.6, h: 101.6, code: "w288h288" },
    { key: "40x30", group: "Small", name: "40 × 30 mm", w: 40, h: 30, code: "w113h85" },
    { key: "50x30", group: "Small", name: "50 × 30 mm", w: 50, h: 30, code: "w141h85" },
    { key: "50x40", group: "Small", name: "50 × 40 mm", w: 50, h: 40, code: "w141h113" },
    { key: "60x40", group: "Small", name: "60 × 40 mm", w: 60, h: 40, code: "w170h113" },
    { key: "70x50", group: "Small", name: "70 × 50 mm", w: 70, h: 50, code: "w198h141" },
    { key: "2x4in", group: "Large", name: '2" × 4"', w: 50.8, h: 101.6, code: "w144h288" },
    { key: "4x2in", group: "Large", name: '4" × 2"', w: 101.6, h: 50.8, code: "w288h144" },
    { key: "4x3in", group: "Large", name: '4" × 3"', w: 101.6, h: 76.2, code: "w288h216" },
    { key: "3x4in", group: "Large", name: '3" × 4.4"', w: 75, h: 112, code: "w212h317" },
  ],
  // Label stock on hand, by finish. Each finish has its colours; `hex` is how
  // it looks on screen. A finish with one colour shows no colour choice.
  finishes: [
    {
      key: "matte",
      name: "Matte",
      body: "Plain paper label. No glare, easy to write on.",
      colours: [
        { key: "white", name: "White", hex: "#f7f6f2" },
        { key: "yellow", name: "Yellow", hex: "#f7d84a" },
        { key: "orange", name: "Orange", hex: "#f59a4a" },
        { key: "pink", name: "Pink", hex: "#f4a7c0" },
        { key: "blue", name: "Blue", hex: "#8fc3ea" },
        { key: "green", name: "Green", hex: "#9ed49a" },
      ],
    },
    {
      key: "chrome",
      name: "Chrome silver",
      body: "Mirror-shiny metallic label.",
      colours: [{ key: "silver", name: "Silver", hex: "#e6e9ed" }],
    },
  ],
  // Offered at checkout, in CAD. `freeOver` waives it on bigger orders.
  delivery: [
    { key: "pickup", name: "Pickup in Vancouver", amount: 0, days: [1, 3], body: "Free. You'll get an email when it's ready." },
    { key: "lettermail", name: "Lettermail, untracked", amount: 2.5, freeOver: 25, days: [3, 8], body: "Flat in an envelope. Free on orders over $25." },
    { key: "tracked", name: "Tracked mail", amount: 12, days: [2, 5], body: "Canada Post with a tracking number." },
  ],
  // Price per sticker = max(minEach, square inches x perSqIn), then the
  // biggest quantity break that applies.
  pricing: {
    perSqIn: 0.15,
    minEach: 0.5,
    chromeExtra: 0.1, // per sticker
    breaks: [
      { qty: 25, off: 0.15 },
      { qty: 100, off: 0.3 },
    ],
  },
};
