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

  // Google Search Console "HTML tag" verification: paste just the content="..."
  // value here. Leave empty if you verified with a DNS record instead.
  googleSiteVerification: "",

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
      price: "from $10",
      unit: "per order",
      body: "You have an STL, 3MF or a MakerWorld / Printables link. I check it, pick settings and print it.",
      includes: ["Most small parts land between $10 and $40", "Priced by material and print time", "Free reprint if it's not right"],
    },
    {
      key: "design",
      title: "Custom design",
      price: "$50",
      unit: "per design",
      body: "No model? Send photos, measurements or the broken part and I'll model it in CAD. One flat price, simple or complex. Printing is priced separately.",
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
  orderMinimum: 10, // $ -- matches "from $10" in Services
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

// The sticker shop (/stickers). Thermal printing on a Nelko PL70E-BT: one
// ink, black, on whatever label stock is loaded. DRAFT numbers -- adjust to taste.
export const stickers = {
  // Die-cut label stock for the Nelko PL70E-BT, from the in-shop Sticker
  // Printer app's size list (TTVV-7/Stickers). `code` is the printer's
  // PageSize; `crop` is the shape a round label starts with.
  sizes: [
    // Every `code` must be a page size the printer offers (the Sticker Printer
    // app's SIZES list, from the PL70e's PPD), or it can't be printed. The 3"
    // round shares w216h216 with the 3" square.
    { key: "round-2in", group: "Round", name: '2" round', w: 50.8, h: 50.8, code: "w144h144", crop: "circle" },
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
  // `sizes` limits a colour to the label sizes it's sold in: size keys or
  // whole groups ("Round", "Small"). No `sizes` = every size. Kept
  // conservative: white is everywhere; colours and chrome only where rolls
  // are easy to find. Widen as you stock more.
  finishes: [
    {
      key: "matte",
      name: "Matte",
      body: "Plain paper label. No glare, easy to write on.",
      colours: [
        { key: "white", name: "White", hex: "#f7f6f2" },
        { key: "yellow", name: "Yellow", hex: "#f7d84a", sizes: ["Round", "Small"] },
        { key: "pink", name: "Pink", hex: "#f4a7c0", sizes: ["Round", "Small"] },
        { key: "orange", name: "Orange", hex: "#f59a4a", sizes: ["Round", "Small"] },
        { key: "green", name: "Green", hex: "#9ed49a", sizes: ["Round", "Small"] },
        { key: "blue", name: "Blue", hex: "#8fc3ea", sizes: ["Round", "Small"] },
      ],
    },
    {
      key: "chrome",
      name: "Chrome silver",
      body: "Mirror-shiny metallic label.",
      colours: [{ key: "silver", name: "Silver", hex: "#e6e9ed", sizes: ["round-2in"] }],
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
  // Full-colour, custom-cut stickers: printed on the inkjet and cut on the
  // Cricut with Print Then Cut. DRAFT prices -- tune once you've made a few.
  colour: {
    // false: the tab shows "Coming soon" and lets people design and preview,
    // but nothing can be added to the cart or checked out (the server refuses
    // colour items too). Set to true to start taking orders.
    available: false,
    // Print Then Cut's largest printable area on letter paper (mm), and the
    // smallest sticker worth cutting. Either orientation fits.
    maxMm: [171, 235],
    minMm: 25,
    finishes: [
      { key: "gloss", name: "Gloss vinyl", body: "Bright, shiny colours. Water resistant." },
      { key: "matte", name: "Matte vinyl", body: "Soft look, no glare. Water resistant." },
    ],
    // Per sticker = max(minEach, square inches x perSqIn), then the biggest
    // quantity break that applies.
    pricing: {
      perSqIn: 0.35,
      minEach: 1.25,
      breaks: [
        { qty: 10, off: 0.1 },
        { qty: 25, off: 0.2 },
        { qty: 50, off: 0.3 },
      ],
    },
  },
  // Bike stickers: a name with a flag, or a ride's route, shown on a bike.
  // Printed and cut like the full-colour stickers. false: the tab shows
  // "Coming soon" and lets people design and preview, with no ordering.
  bike: {
    available: false,
  },
};
