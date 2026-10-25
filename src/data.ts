export const A = (p: string) => `assets/${p}`;
export const EMAIL = "sumahar.pelluri2027@mastersunion.org";
export const LINKS = {
  linkedin: "https://www.linkedin.com/in/sumahar-pelluri-53025b170/",
  github: "https://github.com/sumaharpelluri2027-tech",
  boardiq: "https://investment-analysis-engine.onrender.com",
  wing: "https://ai-analytics-club-mu.onrender.com/",
  decco: "https://decco-store.lovable.app",
  film: "https://youtu.be/Ec_oS-oTlYQ",
};

export const LOGOS = [
  ["masters-union", "Masters' Union"],
  ["rabbit-invest", "Rabbit Invest"],
  ["wipro", "Wipro"],
  ["myntra", "Myntra"],
  ["ai-analytics-wing", "AI & Analytics Wing"],
  ["vit", "VIT Vellore"],
] as const;

export const NUMBERS = [
  { n: 95, pre: "", suf: "%", label: "Data accuracy at Rabbit Invest", from: "up from 50%" },
  { n: 80, pre: "", suf: "%", label: "Recurring manual ops automated", from: "Python, Scripts, APIs" },
  { n: 5, pre: "", suf: "×", label: "Sales conversion", from: "10% → 50%" },
  { n: 3, pre: "₹", suf: "L", label: "Decco Store revenue", from: "first 30 days" },
];

export const SERVICES = [
  { k: "Data & BI", t: "Data you can trust", d: "Ingestion, validation and QC pipelines, then dashboards wired to the KPIs a team actually decides on.", p: "Registrar data accuracy 50% → 95% across CAMS, KFin, AMFI." },
  { k: "Ops & automation", t: "Work that runs itself", d: "SOPs first, then Python, Google Scripts and APIs to remove the repetitive work and its recurring errors.", p: "80% of manual operations automated. Ops function built from zero." },
  { k: "AI products", t: "AI you can inspect", d: "Products where the reasoning is visible: decision framing, data checks, then the model's answer.", p: "Shipped BoardIQ, an explainable investment platform on Gemini." },
];

export const FLOW = [
  ["Objective", "What are you deciding?"],
  ["Data spec", "Fields you must supply"],
  ["Upload", "CSV, XLSX or JSON"],
  ["Validate", "Nulls, duplicates, outliers"],
  ["AI analysis", "Gemini reasoning"],
  ["Verdict", "Buy, hold, pass + confidence"],
  ["Why?", "Evidence, metric, risk"],
  ["Compare", "Companies side by side"],
  ["IC memo", "Board-ready export"],
];

export type Product = { name: string; tag: string; status: string; live: boolean; img?: string; href?: string; d: string; cta?: string };
export const PRODUCTS: Product[] = [
  { name: "AI & Analytics Wing", tag: "Community platform", status: "Live", live: true, img: "img/aiaw-site.jpg", href: LINKS.wing, cta: "Visit the site", d: "The Wing's public home: an editorial story, a decision game and the team network with custom Canvas visuals. 14 versions, designed and built by me." },
  { name: "Decco Store", tag: "D2C commerce", status: "₹3L in 30 days", live: true, img: "img/decco-shot.jpg", href: LINKS.decco, cta: "Visit the store", d: "A vintage-inspired home brand. I picked the products, set prices, built the store and campaigns, then sold in person at our stall." },
  { name: "FitGenie AI", tag: "AI health", status: "Live", live: true, img: "img/fitgenie.jpg", href: "https://fitgenie-ai-buddy.lovable.app", cta: "Try it", d: "Personalised nutrition and workout plans, progress tracking and fitness discovery in one loop." },
  { name: "Smart Shopper AI", tag: "Commerce intelligence", status: "Live", live: true, img: "img/shopper.jpg", href: "https://shopper-smartly.lovable.app", cta: "Try it", d: "Compares price, seller trust, card offers and delivery speed across e-commerce and quick commerce." },
  { name: "Priya", tag: "AI voice agent", status: "In build", live: false, d: "A two-way call agent for a dropshipping business, on Bolna with a Fish Audio cloned voice, designed with the human handoff first." },
  { name: "Brew Home", tag: "D2C prototype", status: "Prototype", live: false, img: "img/brewhome.jpg", d: "A specialty Indian coffee storefront with a flavour quiz that recommends a roast, plus subscriptions." },
];

export type Bar = { l: string; was?: number; v: number; b: string };
export type Role = { co: string; logo: string; role: string; when: string; challenge: string; built: string; bars?: Bar[]; scale?: string; extra?: string; big?: string; bigNote?: string; quote: string; pipeline?: boolean; matrix?: boolean };
export const ROLES: Role[] = [
  {
    co: "Rabbit Invest", logo: "rabbit-invest", role: "Operations & Automation Strategy Lead · founding member", when: "Jan 2024 – Jun 2026 · Delhi",
    challenge: "Investor data arrived fragmented across registrars. Accuracy hovered at 50–60%, and the ops team absorbed the uncertainty by hand.",
    built: "Ingestion, validation and QC across CAMS, KFin and AMFI; reconciliation scripts; KPI dashboards; SOPs; founder-level operating reviews.",
    pipeline: true, matrix: true, scale: "Grey is where it started",
    bars: [ { l: "Data accuracy", was: 50, v: 95, b: "50→95%" }, { l: "Sales conversion", was: 10, v: 50, b: "10→50%" }, { l: "Execution efficiency", v: 100, b: "+200%" } ],
    quote: "Automation only earns trust after the exception paths are designed.",
  },
  {
    co: "Wipro", logo: "wipro", role: "Project Engineer", when: "Jul 2022 – Jan 2024 · Hyderabad",
    challenge: "A growing portfolio of 100+ SMB accounts needed clearer funnel signals and reporting teams could act on.",
    built: "Zoho CRM reporting, acquisition and retention analysis, and the operating cadence around the pipeline.",
    scale: "Reported change · common 0–50% scale",
    bars: [ { l: "Retention funnel", v: 100, b: "+50%" }, { l: "Pipeline visibility", v: 80, b: "+40%" }, { l: "Revenue, own initiatives", v: 60, b: "+30%" }, { l: "Acquisition funnel", v: 30, b: "+15%" } ],
    extra: "Also contributed to company-wide 100% revenue growth and a 50% cut in acquisition cost.",
    quote: "A dashboard is useful only when it changes the next decision.",
  },
  {
    co: "Myntra", logo: "myntra", role: "Data Analyst Intern", when: "Jan – Jun 2022 · Remote",
    challenge: "Marketing spend was moving faster than the team's understanding of where customers dropped out.",
    built: "A conversion-funnel analysis from scratch connecting customer behaviour to channel performance, plus data-quality fixes.",
    big: "CEO-level", bigNote: "budget reallocation across acquisition channels, driven by the funnel analysis I built as an intern.",
    quote: "The sharpest analysis ends in a resource decision, not another chart.",
  },
];

export const EDU = [
  { logo: "masters-union", t: "Masters' Union", d: "PGP in Technology & Business Management '27 · VP, AI & Analytics Wing" },
  { logo: "vit", t: "VIT, Vellore", d: "B.Tech Mechanical · CGPA 8.39 · BAJA SAE All India Rank 8" },
];

export const GALLERY = [
  ["img/aiaw-event.jpg", "Wing internal event, a full room"],
  ["img/aiaw-team.jpg", "The Wing's core team"],
  ["img/decco-stall.jpg", "Running the Decco stall"],
  ["img/decco-team.jpg", "Team Decco at the market"],
] as const;

export const WING = [
  { n: "04", t: "Case Union 4.0", d: "Four of our AI problem statements shortlisted for MU's national case competition." },
  { n: "14", t: "Website versions", d: "The Wing's site, iterated until the work was easy to find and join." },
  { n: "01", t: "Event, end to end", d: "“Turning Business Challenges into AI Opportunities”, with a QR feedback system." },
  { n: "01", t: "Recruitment system", d: "A scoring workbook so every core-team candidate was judged on the same evidence." },
];

export const SKETCHES = [
  { s: "Round 2 · The Ken", hot: true, t: "Arogya", d: "Agentic AI for family health that reorders medicine for a parent in another city. Shortlisted for Round 2 of The Ken's Great Rewiring." },
  { s: "Prototype", t: "Snip", d: "A marketplace and CRM connecting people with tailors, boutiques and designers across India." },
  { s: "Validating", t: "FoodTruth AI", d: "Decodes packaged-food claims, ingredients and nutrition for fitness-focused buyers." },
  { s: "Delivered", hot: true, t: "IKSHANA Z INC", d: "A multi-state incorporation analysis on tax and permits. The client adopted my Delaware recommendation." },
  { s: "Completed", t: "TrustMRR EDA", d: "Exploratory analysis of a SaaS dataset, written up as a consulting-style executive summary." },
  { s: "Completed", t: "AI Insurance Assistant", d: "Claims-processing automation in Make.com, with a map of the Indian insurtech sector." },
  { s: "Pitched", t: "Decoding F&B", d: "Fusion condiments: Chilli Crisp × Tadka and a Kokum hot sauce. 16 slides cut to six for a five-minute panel." },
  { s: "Concept", t: "Kinfolio", d: "A financial legacy and family-continuity platform, backed by regulatory research." },
  { s: "AI film · Google Flow", hot: true, t: "The campaign film", d: "My first AI film: the generative-video campaign that got me elected VP of the Wing.", href: LINKS.film },
] as { s: string; t: string; d: string; hot?: boolean; href?: string }[];

export const METHOD = [
  ["Frame the decision", "Start with what must change, not which tool looks interesting."],
  ["Trace the mess", "Map inputs, owners, handoffs and delays. Opportunities hide between teams."],
  ["Make data earn trust", "Validate sources and show a confidence level before any intelligence."],
  ["Design the loop", "Observe, decide, act, record, and know when to ask a human."],
  ["Ship, measure, tighten", "Release the smallest complete loop; turn each exception into a better system."],
];

export const TOOLKIT: { name: string; head: string; skills: [string, string][] }[] = [
  { name: "Data & analytics", head: "50% → 95% data accuracy at Rabbit Invest, from QC automation across CAMS, KFin and AMFI.", skills: [["SQL", "Querying and reconciling fund data across three registrar feeds every day at Rabbit Invest."], ["Pandas", "The workhorse behind every reconciliation and QC script I wrote at Rabbit."], ["ETL", "Ingestion, validation and QC as one repeatable pipeline instead of one-off clean-ups."], ["Data validation", "Null, duplicate and outlier rules that moved accuracy from 50% to 95%."], ["Funnel analysis", "My Myntra project, which informed a CEO-level budget reallocation."], ["Looker", "Dashboards the sales team actually triaged from, as conversion went from 10% to 50%."], ["EDA", "The TrustMRR SaaS dataset, written up as a consulting-style executive summary."]] },
  { name: "Automation & AI", head: "80% of manual ops automated, and BoardIQ, a full Gemini-powered decision platform, shipped end to end.", skills: [["Python automation", "Replaced the recurring manual operations work that used to eat the team's week."], ["Make.com", "No-code orchestration, including a working AI insurance claims assistant."], ["Agentic AI design", "Designing the decision chain, not just the prompt. BoardIQ and Arogya are the proof."], ["Gemini", "Reasoning and search grounding behind BoardIQ's verdicts and memos."], ["Google Scripts", "The glue between Sheets, mail and the registrar APIs at Rabbit."], ["REST APIs", "Pulled CAMS, KFin and AMFI data directly instead of waiting for exports."], ["Selenium", "Scraped what had no API worth using."], ["Bolna + Fish Audio", "Priya, a two-way AI voice call agent with a cloned voice."]] },
  { name: "Ops & management", head: "Built the ops function from zero as a founding member, and sat in founder-level decisions.", skills: [["SOP design", "Wrote the operating manual for a function that had none."], ["KPI governance", "Defined what got measured, so automation went after the real bottleneck."], ["Zoho CRM", "Rebuilt reporting for +40% pipeline visibility across 100+ SMB accounts."], ["Founder-level comms", "Represented operations in founder meetings at Rabbit Invest."], ["Recruitment ops", "Ran the Wing's hiring workbook, feedback and QR systems as VP."], ["Event ops", "Wing events end to end: logistics, communication and the debrief."]] },
  { name: "Product & growth", head: "₹3 lakh revenue on Decco Store: storefront, catalogue, pricing, campaigns and the physical stall.", skills: [["Shopify", "D2C storefront mechanics: catalogue, pricing and checkout."], ["Lovable", "Four live products shipped on it, including Decco Store and FitGenie."], ["React + TypeScript", "BoardIQ's twelve-screen front end, and this site."], ["Campaign analytics", "Wired campaigns to KPIs so spend could be judged, not guessed."], ["Pricing", "Set the margins that made Decco profitable, not just busy."]] },
  { name: "Cloud & tooling", head: "AWS Cloud Practitioner (2022), and everything I build gets deployed, not left on localhost.", skills: [["AWS", "Certified Cloud Practitioner, 2022."], ["Render", "Hosts BoardIQ, the Wing site and this portfolio."], ["Git + GitHub", "Every build versioned at github.com/sumaharpelluri2027-tech."], ["Three.js", "The particle field behind this page."]] },
];

export const MILESTONES = [
  ["AIR 8", "BAJA SAE Enduro", "Designed the car's hybrid braking architecture."],
  ["VP", "AI & Analytics Wing", "Elected to lead the Wing at Masters' Union."],
  ["04", "Case Union 4.0", "Four Wing problem statements shortlisted nationally."],
  ["R2", "The Ken · Great Rewiring", "Shortlisted to Round 2 with Arogya."],
  ["02", "Leadership campaigns", "Strategy for FOCOS Club and Google Fraternity Presidents."],
  ["1ST", "Powerlifting deadlift", "First place in my weight category."],
  ["AWS", "Cloud Practitioner", "Certified in 2022."],
  ["TOP 5%", "State cohort", "Class XII 94.5%, Class X 9.7 CGPA."],
];

export const STORY = [
  { n: "CHAPTER 01", bg: "desk", big: "I don't start with tools. I start with what's broken.", sub: "Every system I've built began the same way: find the manual process nobody wanted to own, then make it measurable." },
  { n: "CHAPTER 02", bg: "network", metric: "50→95%", big: "Data you can trust.", sub: "Ingestion, validation and QC automation across CAMS, KFin and AMFI, built from scratch at Rabbit Invest." },
  { n: "CHAPTER 03", bg: "network", metric: "80%", big: "Days of manual work, gone.", sub: "Python, Google Scripts and REST APIs replaced the work that ate the team's week, and the errors that came with it." },
  { n: "CHAPTER 04", bg: "desk", metric: "5×", big: "A funnel that finally converted.", sub: "Dashboards wired to real KPIs made every drop-off visible. Conversion went from 10% to 50%." },
  { n: "CHAPTER 05", bg: "decco-stall", metric: "₹3L", big: "Not just dashboards. A real business.", sub: "Decco Store: products, pricing, storefront, campaigns and a physical stall, in 30 days." },
  { n: "CHAPTER 06", bg: "aiaw-event", big: "Then I started shipping my own products.", sub: "And leading the AI & Analytics Wing at Masters' Union.", chips: ["BoardIQ", "Wing website", "FitGenie AI", "Smart Shopper", "Decco Store", "Priya"] },
  { n: "NOW", bg: "network", portrait: true, big: "Sumahar Pelluri", sub: "PGP-TBM '27, Masters' Union. Open to Data/BI, Founder's Office and Product roles.", chips: ["Close the story to explore →"] },
] as { n: string; bg: string; big: string; sub: string; metric?: string; chips?: string[]; portrait?: boolean }[];
