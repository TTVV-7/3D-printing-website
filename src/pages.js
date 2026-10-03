// ---------------------------------------------------------------------------
// Service and product landing pages. Each one is its own URL (printyours.ca/<slug>) built
// around the phrases people search for, so the site can rank for more than
// one thing. Pre-rendered to real HTML at build time and listed in the sitemap.
//
// Keep it honest: titles and FAQ answers show up verbatim in Google.
// ---------------------------------------------------------------------------

export const pages = [
  {
    slug: "online-3d-printing-service",
    nav: "Online STL printing",
    title: "Online 3D Printing Service in Canada: Upload an STL | Print Yours",
    description:
      "Upload an STL, 3MF or STEP file and get it 3D printed and shipped anywhere in Canada or the US. " +
      "Fixed price quote within one business day, no account needed.",
    eyebrow: "Online 3D printing · Ships across Canada",
    h1: "Online 3D printing service: send a file, get a part in the mail",
    intro:
      "Have an STL and no printer, or a printer that can't handle the job? Upload the file, tell me the " +
      "material and quantity, and I'll send back a fixed price. Once you approve it, the part is printed, " +
      "checked and shipped to your door.",
    points: ["STL, 3MF, STEP, OBJ", "Free quote in 1 business day", "Shipped Canada & US"],
    uses: [
      { title: "Files from MakerWorld, Printables & Thingiverse", body: "Paste the link. I'll check the model prints cleanly and suggest the right settings before quoting." },
      { title: "Your own CAD exports", body: "Export STL or STEP from Fusion, Onshape, SolidWorks, FreeCAD or Tinkercad. STEP keeps dimensions exact." },
      { title: "Parts too big or tough for your printer", body: "Up to 256 mm on each side, in PLA, PETG, Nylon or TPU." },
      { title: "Multiple copies", body: "One part or a few hundred. Price per part drops with quantity." },
    ],
    sections: [
      {
        h2: "How online 3D printing works here",
        body: [
          "You don't need an account or a credit card to get a price. Fill in the quote form with your file or link, the quantity, and anything the part needs to do: hold weight, sit outside, flex, look good on a shelf.",
          "Every file is checked by a person before it's quoted. If a wall is too thin, an overhang needs support, or the part would be stronger printed on its side, you'll hear about it before you pay for it, not after.",
        ],
      },
      {
        h2: "Shipping across Canada and the US",
        body: [
          "Parts are printed in Vancouver, BC and shipped by tracked mail. Shipping is added on top of the print price and depends on the size and weight of the package, so your quote will show both. Customers in Metro Vancouver can skip shipping and pick up for free.",
        ],
      },
    ],
    faqs: [
      { q: "What file formats can I upload?", a: "STL, 3MF, STEP and OBJ, or a link to MakerWorld, Printables or Thingiverse. If you only have photos or a drawing, I can model the part for you." },
      { q: "Is there a minimum order?", a: "No. A single small part is fine, and so is a run of a few hundred." },
      { q: "What if my file has problems?", a: "I check every model before quoting. If something needs fixing, I'll tell you what and either repair it or quote the fix." },
    ],
  },
  {
    slug: "3d-printed-replacement-parts",
    nav: "Replacement parts",
    title: "3D Printed Replacement Parts, Made to Fit | Print Yours",
    description:
      "Broken plastic clip, knob, bracket or discontinued part? Get a custom 3D printed replacement, " +
      "modelled from photos or measurements. Vancouver-made, shipped across Canada.",
    eyebrow: "Replacement parts · Vancouver & Canada-wide",
    h1: "3D printed replacement parts for things that are hard to fix",
    intro:
      "A snapped appliance clip, a missing knob, a bracket the manufacturer stopped making. Instead of " +
      "replacing the whole thing, send a photo and a few measurements and get a new part printed to fit.",
    points: ["No model needed", "Free quote in 1 business day", "Pickup or shipped"],
    uses: [
      { title: "Appliance parts", body: "Dishwasher rack clips, fridge shelf brackets, dryer knobs, vacuum latches, battery covers." },
      { title: "Furniture & home", body: "Shelf pins, drawer slides, curtain rod brackets, cabinet bumpers, IKEA bits." },
      { title: "Cars, bikes & outdoor gear", body: "Trim clips, interior covers, light mounts, bike computer mounts, tent and pack buckles." },
      { title: "Discontinued & obsolete parts", body: "When the original is no longer sold, or only comes bundled with a $200 assembly." },
    ],
    sections: [
      {
        h2: "No 3D model? Send photos and measurements",
        body: [
          "Most replacement parts don't have a file anywhere online. That's fine. Send clear photos of the broken part (and where it goes) with a ruler or calipers in the shot, and I'll model it in CAD. Design time is quoted up front with the print.",
          "If you still have the broken pieces, even better: they can be mailed or dropped off in Vancouver and measured directly.",
        ],
      },
      {
        h2: "Picking a material that lasts",
        body: [
          "Replacement parts usually need to be tougher than display prints. PETG handles heat, water and outdoor use; Nylon is best for clips, hinges and anything that flexes or wears. You'll get a recommendation with your quote.",
        ],
      },
    ],
    faqs: [
      { q: "Can you 3D print a replacement for a broken plastic part?", a: "Usually, yes. Most clips, brackets, knobs, covers and housings can be modelled and printed. Parts that need to be food-safe, hold high heat or carry a heavy load are discussed case by case." },
      { q: "How accurate will the replacement be?", a: "With good measurements, fit is typically within a few tenths of a millimetre. For tight fits I'll often print a quick test piece first." },
      { q: "Is it cheaper than buying the original part?", a: "Often, especially for discontinued parts or small pieces only sold as part of a larger assembly. The quote is free, so it's easy to compare." },
    ],
  },
  {
    slug: "rapid-prototyping",
    nav: "Prototyping",
    title: "Rapid Prototyping & 3D Printed Prototypes in Canada | Print Yours",
    description:
      "Fast, affordable 3D printed prototypes for product designers, startups and inventors. " +
      "Iterate on fit and form before tooling. Vancouver-based, shipping across Canada and the US.",
    eyebrow: "Rapid prototyping · Vancouver & Canada-wide",
    h1: "Rapid prototyping: hold your idea in your hands this week",
    intro:
      "Test fit, size and feel before you spend on tooling or a large order. Send your CAD and get a " +
      "printed prototype back in days, then revise and reprint as many times as the design needs.",
    points: ["Most prototypes in 3–5 days", "Design feedback included", "NDAs welcome"],
    uses: [
      { title: "Enclosures & housings", body: "Electronics cases, PCB mounts, battery boxes and snap-fit lids." },
      { title: "Fit & form checks", body: "Check a part against the real thing before ordering it machined or moulded." },
      { title: "Consumer product models", body: "Ergonomics, button placement and size checks for pitch meetings and user testing." },
      { title: "Functional test parts", body: "Brackets, mechanisms and fixtures printed in PETG or Nylon for real-world testing." },
    ],
    sections: [
      {
        h2: "Prototyping that's quick to iterate",
        body: [
          "Prototypes are rarely right the first time. Send revision two the moment it's ready and it goes straight into the queue. You talk to the person printing it, so feedback on wall thickness, tolerances or orientation comes back with each quote.",
        ],
      },
      {
        h2: "From prototype to small production run",
        body: [
          "Once the design is settled, the same parts can be printed in batches of a few to a few hundred, which is often enough for a first product launch, a Kickstarter or replacement stock.",
        ],
      },
    ],
    faqs: [
      { q: "How fast can I get a prototype?", a: "Most prototypes are ready 3–5 days after you approve the quote, plus shipping time outside Vancouver. Mention any deadline in your request." },
      { q: "Will you sign an NDA?", a: "Yes. Mention it in your request and send it over before sharing files." },
      { q: "What tolerances should I design for?", a: "For FDM printing, plan for about 0.2–0.3 mm clearance on sliding or snap fits. If you're unsure, I'll flag anything in your model that might be too tight." },
    ],
  },
  {
    slug: "small-batch-3d-printing",
    nav: "Small batches",
    title: "Small-Batch 3D Printing & Low-Volume Production | Print Yours",
    description:
      "Low-volume 3D printing from a handful to a few hundred identical parts. Jigs, fixtures, enclosures, " +
      "merch and spares for small businesses. Shipped across Canada and the US.",
    eyebrow: "Small batches · Low-volume production",
    h1: "Small-batch 3D printing for short production runs",
    intro:
      "Need 20, 50 or 300 of the same part? Small-batch 3D printing skips the cost of injection-moulding " +
      "tools and lets you change the design between batches. Every part is printed to the same settings " +
      "and checked before it ships.",
    points: ["A few to a few hundred parts", "Consistent, checked parts", "Reorder any time"],
    uses: [
      { title: "Jigs, fixtures & shop tools", body: "Assembly jigs, drill guides, cable organisers and tool holders for workshops and production lines." },
      { title: "Product enclosures", body: "Cases and housings for small electronics runs where moulds don't make sense yet." },
      { title: "Merch & giveaways", body: "Branded keyrings, NFC business fobs, signs and desk items for events and shops." },
      { title: "Spare parts stock", body: "Replacement parts kept on hand for a business, a fleet of machines or a product you sell." },
    ],
    sections: [
      {
        h2: "When small-batch printing beats moulding",
        body: [
          "Injection moulding gets cheap at thousands of parts, but the tooling alone can cost thousands of dollars. Under a few hundred parts, or while a design is still changing, 3D printing is usually cheaper and much faster to start.",
        ],
      },
      {
        h2: "Repeat orders",
        body: [
          "Your files and settings are kept on hand, so reordering is a one-line email. Batches can be split across colours or materials if you need variety.",
        ],
      },
    ],
    faqs: [
      { q: "How many parts can you print in one order?", a: "Anything from a few to a few hundred identical parts is a good fit. For larger runs, ask and I'll give you a realistic timeline." },
      { q: "Does the price per part go down with quantity?", a: "Yes. Setup and checking are shared across the batch, so larger quantities cost less per part." },
      { q: "Can you add my logo or text?", a: "Yes. Logos, names and serial numbers can be embossed, debossed or printed in a second colour." },
    ],
  },
  {
    slug: "3d-modeling-service",
    nav: "CAD design",
    title: "Custom 3D Modeling & CAD Design for 3D Printing | Print Yours",
    description:
      "No 3D model? Get a part designed in CAD from photos, measurements or a sketch, then printed. " +
      "Design time quoted up front. Vancouver-based, working with customers across Canada.",
    eyebrow: "3D modeling · CAD design service",
    h1: "Custom 3D modeling: from photo or sketch to printable part",
    intro:
      "Most people with a good idea don't have a 3D model of it. Send photos, rough measurements or a " +
      "sketch on paper, and I'll design the part in CAD, then print it. You get the file too.",
    points: ["From photos or sketches", "Design time quoted up front", "You keep the file"],
    uses: [
      { title: "Replacement parts", body: "Recreate a broken or missing part from photos and measurements." },
      { title: "Modifications", body: "Change a model you found online: resize it, add mounting holes, fit it to your device." },
      { title: "Brackets & mounts", body: "Custom mounts for cameras, sensors, lights, tablets and tools, sized to what you have." },
      { title: "Product ideas", body: "Turn a sketch into a printable first prototype you can test and show." },
    ],
    sections: [
      {
        h2: "What to send for a design quote",
        body: [
          "Photos from a few angles with a ruler in frame, the key measurements (holes, widths, thicknesses), and a sentence about what the part has to do. If it attaches to something, a photo of that helps too.",
          "Simple brackets and replacement clips usually take an hour or two of design time. You'll get a fixed design price before any work starts.",
        ],
      },
    ],
    faqs: [
      { q: "Do I get the 3D model file?", a: "Yes. Once the design is paid for, you get the STL (and STEP on request) so you can reprint it anywhere." },
      { q: "Can you work from a drawing or sketch?", a: "Yes. A hand sketch with dimensions is often all that's needed for simple parts." },
      { q: "Can you modify an existing STL?", a: "Usually. Resizing, adding holes or text, and joining or splitting parts are all common requests." },
    ],
  },
  {
    slug: "custom-topographic-maps",
    nav: "Topographic maps",
    title: "Custom 3D Printed Topographic Maps & City Models | Print Yours",
    description:
      "Custom 3D printed relief maps of mountains, lakes, trails and cities. A gift for hikers, skiers " +
      "and anyone who loves a place. Made in Vancouver, shipped across Canada and the US.",
    eyebrow: "Topographic maps · City models",
    h1: "Custom 3D printed topographic maps and city models",
    intro:
      "A raised relief map of the mountain you climbed, the lake you grew up on, or the city you live in. " +
      "Printed from real elevation data in multiple colours, so the water, forest and peaks stand out.",
    points: ["Any place you choose", "Multi-colour prints", "Ships across Canada & US"],
    photo: "/work/vancouver-mountains-2.webp",
    photoAlt: "3D-printed relief map of Vancouver with green mountains and blue water",
    gallery: [
      { src: "/work/vancouver-mountains-3.webp", alt: "Angled view of a printed Vancouver relief map showing raised North Shore mountains" },
      { src: "/work/downtown-vancouver.webp", alt: "Multi-colour 3D-printed model of downtown Vancouver's skyline" },
    ],
    uses: [
      { title: "Mountains & ski hills", body: "Peaks, ranges and resorts with real terrain, from the North Shore to the Rockies." },
      { title: "Lakes, coastlines & cabins", body: "The lake, bay or valley that means something, with water printed in blue." },
      { title: "Trails & race routes", body: "Mark a hike, trail run or bike route across the terrain." },
      { title: "City skylines", body: "Downtown blocks, streets and parks printed as a desk or wall piece." },
    ],
    sections: [
      {
        h2: "A gift that's actually about the person",
        body: [
          "Topographic maps make great gifts for hikers, climbers, skiers and anyone moving away from a place they love. Send a location (a town, a peak, a pin on Google Maps) and the size you want, and you'll get a preview and a price before it's printed.",
          "This is where Print Yours started: the North Shore mountains and downtown Vancouver models in the photos were printed here.",
        ],
      },
    ],
    faqs: [
      { q: "Can you make a 3D map of any location?", a: "Most places, yes. Elevation data covers nearly everywhere. Very flat areas look better with exaggerated height, which I'll suggest in the preview." },
      { q: "How big can a topographic map be?", a: "A single print can be up to about 25 cm square. Larger maps can be printed as tiles that fit together." },
      { q: "Can you add text or mark a route?", a: "Yes. Titles, coordinates, and a route or pin in a contrasting colour can all be added." },
    ],
  },

  // --- Products you design yourself in the generator (site.designerUrl) -----
  {
    slug: "nfc-business-card",
    group: "product",
    designer: "/?shape=nfc-card",
    nav: "NFC business cards",
    title: "Custom NFC Business Cards Shaped Like Your Logo | Print Yours",
    description:
      "A 3D printed NFC business card cut to the shape of your logo, in your logo's colours. Tap a phone to " +
      "open your website or contact. Design it online, shipped across Canada and the US.",
    eyebrow: "NFC business cards · Design online",
    h1: "NFC business cards in the shape of your logo",
    intro:
      "Upload your logo and the card comes out in its outline and its colours, with an NFC chip sealed " +
      "inside. Tap it to any phone and it opens your link. Add a keyring hole and it lives on someone's keys " +
      "instead of in a drawer.",
    points: ["Upload SVG, PNG or JPEG", "NFC chip sealed inside", "Ships Canada & US"],
    photo: "/designer/nfc-logo-card.webp",
    photoFit: "contain", // render on white: show it whole, not cropped
    photoAlt: "3D printed NFC business card in the shape of a company logo, front and back",
    uses: [
      { title: "Business cards that get kept", body: "A card on a keyring gets looked at every day. A paper card gets recycled." },
      { title: "Trade shows & events", body: "Hand out a batch with your logo; every tap goes straight to your site or booking page." },
      { title: "Real estate & trades", body: "Give clients a fob that opens your contact card or reviews page." },
      { title: "Team & staff cards", body: "One logo, each card linked to a different person's details." },
    ],
    sections: [
      {
        h2: "Design it yourself in the browser",
        body: [
          "Open the designer, upload your logo, and watch the card rebuild in 3D. Pick where the keyring hole goes, whether the logo appears on both sides, and how high each colour stands off the card.",
          "When it looks right, send it over with a quote request and I'll print, program and ship it.",
        ],
      },
    ],
    faqs: [
      { q: "What phones can read an NFC business card?", a: "Almost all current iPhones and Android phones read NFC tags without an app. Hold the phone near the card and it offers to open the link." },
      { q: "What file should my logo be?", a: "An SVG works best. PNG and JPEG logos are traced automatically; a clean logo on a plain background traces best." },
      { q: "Can I order a batch for my team or an event?", a: "Yes. Cards are a good fit for small runs; ask for a quote with the quantity you need." },
    ],
  },
  {
    slug: "custom-name-keychain",
    group: "product",
    designer: "/?shape=name-keychain",
    nav: "Name keychains",
    title: "Custom 3D Printed Name Keychains in 48 Fonts | Print Yours",
    description:
      "Design a custom name keychain online in any of 48 typefaces, from clean to script to blackletter. " +
      "3D printed in your colours in Vancouver and shipped across Canada and the US.",
    eyebrow: "Name keychains · Design online",
    h1: "Custom name keychains, designed by you in the browser",
    intro:
      "Type a name, pick one of 48 typefaces, and the letters are welded into one solid keychain with a " +
      "tab for the ring. Preview it in 3D, then order it printed in the colours you want.",
    points: ["48 typefaces", "Live 3D preview", "Great for gifts & teams"],
    photo: "/designer/keyring.webp",
    photoAlt: "Green and white 3D printed name keychain spelling Freddie",
    uses: [
      { title: "Personal gifts", body: "Birthdays, stocking stuffers and teacher gifts with the person's name on them." },
      { title: "Teams & classes", body: "A keychain for every player, student or bridesmaid, each with their own name." },
      { title: "Bag & backpack tags", body: "Make school bags and gym bags easy to tell apart." },
      { title: "Events & party favours", body: "Names for every guest at a wedding, shower or kids' party." },
    ],
    sections: [
      {
        h2: "Pick the style that suits the name",
        body: [
          "The 48 typefaces run from simple sans-serif to brush scripts, slab serifs, comic faces and blackletter. The designer adjusts the size and joins the letters so every keychain prints as one strong piece.",
        ],
      },
    ],
    faqs: [
      { q: "Can I order keychains with different names?", a: "Yes. Design each name, then send them together in one quote request." },
      { q: "How long is a name keychain?", a: "It depends on the name and typeface; the designer shows the size as you type. Long names can be printed smaller or on two lines." },
    ],
  },
  {
    slug: "custom-pet-tags",
    group: "product",
    designer: "/?shape=pet-tag",
    nav: "Pet tags",
    title: "Custom 3D Printed Pet ID Tags with QR Code or NFC | Print Yours",
    description:
      "Design a custom dog or cat ID tag online: bone, paw, heart and more, with the name on the front and " +
      "your number, a QR code or a sealed NFC chip on the back. Shipped across Canada and the US.",
    eyebrow: "Pet ID tags · Design online",
    h1: "Custom pet ID tags with a QR code or tap-to-call NFC",
    intro:
      "The pet's name on the front, the way home on the back. Choose a bone, paw print, heart, round, fish, " +
      "cat head, shield or slide-on collar tag, add your phone number, and optionally a QR code or an NFC " +
      "chip so anyone who finds your pet can tap and call you.",
    points: ["8 shapes + slide-on", "QR code or NFC chip", "Lettering inlaid, won't rub off"],
    photo: "/designer/pet-tags.webp",
    photoFit: "contain", // render on white: show it whole, not cropped
    photoAlt: "Eight 3D printed pet ID tags in navy and gold: round, bone, heart and slide-on shapes, front and back",
    uses: [
      { title: "Dog tags", body: "Bone, round and shield shapes on a ring, or a slide-on plate for a quieter collar." },
      { title: "Cat tags", body: "Small round, fish and cat-head tags that are light enough for a cat collar." },
      { title: "Tap-to-call NFC", body: "A chip sealed inside holds your number. A phone held to the tag offers to call it." },
      { title: "QR code backs", body: "Link to a pet profile, medical notes or your contact page." },
    ],
    sections: [
      {
        h2: "Built to survive a dog",
        body: [
          "The lettering is inlaid into the tag in a second colour rather than printed on top, so it doesn't scratch or wear off. An NFC chip is sealed inside during printing, protected from rain, baths and teeth.",
        ],
      },
    ],
    faqs: [
      { q: "What collar sizes do slide-on tags fit?", a: "Slide-on tags are made for collars from 10 to 38 mm wide; the designer sizes the slots to your collar." },
      { q: "Do I need an app to read the NFC tag?", a: "No. Most current phones read it directly and offer to call the number stored on it." },
    ],
  },
  {
    slug: "custom-phone-case",
    group: "product",
    designer: "/case",
    nav: "Phone cases",
    title: "Custom 3D Printed iPhone Case with Your Own Artwork | Print Yours",
    description:
      "Upload your own artwork and get a custom 3D printed iPhone case with the design printed in colour " +
      "into the back. Preview it on the phone in 3D, then order. Shipped across Canada and the US.",
    eyebrow: "Phone cases · Design online",
    h1: "Custom iPhone cases printed with your own artwork",
    intro:
      "Pick your iPhone model, drop in an SVG of your artwork or logo, and watch the back of the case redraw " +
      "in colour. The design is printed into the case itself in multiple filaments, not stuck on as a sticker.",
    points: ["Most recent iPhone models", "Your own SVG artwork", "3D preview on the phone"],
    photo: "/designer/phone-case.webp",
    photoFit: "contain", // render on white: show it whole, not cropped
    photoAlt: "Preview of a custom 3D printed phone case with blue, red and white artwork on a grey back",
    uses: [
      { title: "Your own art", body: "Illustrations, patterns and lettering from your SVG files." },
      { title: "Logo cases", body: "Branded cases for a business, a team or a giveaway." },
      { title: "Gifts", body: "A case with a pet, a place or an inside joke on it." },
      { title: "Matching sets", body: "The same design across a few different iPhone models." },
    ],
    sections: [
      {
        h2: "Colour that's part of the case",
        body: [
          "Each line of the back is laid down in the filament your artwork calls for, so the colours are part of the case rather than a print on top. The designer shows the case on the phone in 3D before you order.",
        ],
      },
    ],
    faqs: [
      { q: "Which phones are supported?", a: "Most recent iPhone models. The designer lists every model it can make a case for." },
      { q: "What artwork works best?", a: "Bold shapes and a handful of solid colours. Very fine detail and gradients are simplified to the colours available." },
    ],
  },
  {
    slug: "light-up-signs",
    group: "product",
    designer: "/?shape=light-up-sign",
    nav: "Light-up signs",
    title: "Custom Light-Up Signs, 3D Printed with Your Word or Logo | Print Yours",
    description:
      "A slim custom LED light box with your word or logo lit through the face. Great for shopfronts, " +
      "counters, desks and doors. Design it online, made in Vancouver, shipped across Canada.",
    eyebrow: "Light-up signs · Design online",
    h1: "Custom light-up signs with your word or logo",
    intro:
      "A shallow light box with the letters lit through its face: a name over a door, a room number, an " +
      "OPEN sign for the counter. An LED strip sits inside, and the letters are the only place the light gets out.",
    points: ["Your word or logo", "LED lit", "Shops, desks & doors"],
    photo: "/designer/sign.webp",
    photoAlt: "Dark 3D printed sign enclosure with the word OPEN lit through its face",
    uses: [
      { title: "Shopfront & counter signs", body: "OPEN, your shop name or a menu callout." },
      { title: "Room & door signs", body: "Names, room numbers and studio signs." },
      { title: "Desk & stream setups", body: "Your name, handle or logo glowing behind you." },
      { title: "Event signs", body: "Wedding names, bar signs and photo-booth backdrops." },
    ],
    sections: [
      {
        h2: "How the sign is made",
        body: [
          "The face is printed first: an opaque layer with the letters cut out, the letters filled back in with translucent filament, and a diffuser behind them so the light is even. The lead exits through a notch in the bottom wall.",
        ],
      },
    ],
    faqs: [
      { q: "Does the sign come with lights?", a: "Ask in your quote request. Signs can be supplied as the printed enclosure only or with an LED strip fitted." },
      { q: "Can I use my logo instead of text?", a: "Yes. Upload an SVG and the logo is cut through the face the same way as letters." },
    ],
  },
  {
    slug: "custom-stencils",
    group: "product",
    designer: "/?shape=stencil",
    nav: "Stencils",
    title: "Custom Stencils from Your Text or Logo, 3D Printed | Print Yours",
    description:
      "Custom reusable plastic stencils of any word or SVG logo, with every letter bridged so the centres " +
      "stay in. Design online, printed in Vancouver and shipped across Canada and the US.",
    eyebrow: "Custom stencils · Design online",
    h1: "Custom stencils from any word or logo",
    intro:
      "Type a word or upload an SVG and get a reusable plastic stencil plate with it cut clean through. " +
      "Every island is bridged automatically, so the middles of letters like O, A and R stay in place.",
    points: ["Text or SVG logo", "Reusable plastic", "Auto-bridged letters"],
    photo: "/designer/stencil.webp",
    photoAlt: "Red 3D printed plastic stencil plate with the word SHOP cut through it",
    uses: [
      { title: "Signs & walls", body: "Shop names, house numbers and wall lettering." },
      { title: "Crates, boxes & gear", body: "Mark tool boxes, shipping crates and equipment." },
      { title: "Crafts & merch", body: "Spray-paint or screen your logo on shirts, bags and wood." },
      { title: "Cakes & coffee", body: "Dusting stencils for cakes and latte art (food-safe printing on request)." },
    ],
    sections: [
      {
        h2: "Stencils that don't fall apart",
        body: [
          "Letters with enclosed shapes normally lose their centres when cut. The designer adds thin bridges to every island so the stencil holds together and can be reused again and again.",
        ],
      },
    ],
    faqs: [
      { q: "How big can a stencil be?", a: "A single plate can be up to about 25 cm across. Larger stencils can be split into sections that line up." },
      { q: "Can I wash and reuse it?", a: "Yes. The plastic stencils clean up with water or the solvent for your paint." },
    ],
  },
];

export const pageBySlug = Object.fromEntries(pages.map((p) => [p.slug, p]));
export const services = pages.filter((p) => p.group !== "product");
export const products = pages.filter((p) => p.group === "product");
