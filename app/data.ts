export const links = {
  email: "mailto:sumahar.pelluri2027@mastersunion.org",
  linkedin: "https://www.linkedin.com/in/sumahar-pelluri-53025b170/",
  github: "https://github.com/sumaharpelluri2027-tech"
};

export const metrics = [
  { value: 95, prefix: "", suffix: "%", label: "data accuracy", detail: "from 50%" },
  { value: 80, prefix: "", suffix: "%", label: "manual ops automated", detail: "Python + APIs" },
  { value: 5, prefix: "", suffix: "×", label: "conversion", detail: "10% → 50%" },
  { value: 200, prefix: "+", suffix: "%", label: "execution efficiency", detail: "at Rabbit Invest" },
  { value: 3, prefix: "₹", suffix: "L", label: "Decco revenue", detail: "first 30 days" }
];

export const cases = [
  {
    company: "Rabbit Invest", role: "Operations & Automation Strategy Lead · Founding Member", period: "JAN 2024 — JUN 2026", place: "DELHI",
    problem: "Investor data arrived fragmented across registrars. Accuracy hovered at 50–60%, and the operations team absorbed the uncertainty by hand.",
    responsibility: "Make the data trustworthy enough to support hundreds of crores in mutual-fund transactions—and build the operations function around it.",
    built: "Ingestion, validation and QC workflows across CAMS, KFin and AMFI; reconciliation scripts; KPI dashboards; SOPs; and founder-level operating reviews.",
    automation: "Python, Google Scripts and REST APIs removed 80% of recurring manual work.",
    impact: ["50% → 95% data accuracy", "10% → 50% conversion", "+200% execution efficiency"],
    lesson: "Automation only earns trust after the exception paths are designed. The system is the happy path and the recovery path."
  },
  {
    company: "Wipro Pvt Ltd", role: "Project Engineer", period: "JUL 2022 — JAN 2024", place: "HYDERABAD",
    problem: "A growing SMB portfolio needed clearer funnel signals and a reporting layer teams could act on.",
    responsibility: "Turn commercial activity into visible, measurable decisions across more than 100 SMB accounts.",
    built: "Zoho CRM reporting, acquisition and retention analysis, and the operating cadence around the pipeline.",
    automation: "Standardized CRM reporting replaced scattered updates and made the funnel legible to stakeholders.",
    impact: ["+15% acquisition funnel", "+50% retention", "+40% pipeline visibility", "+30% revenue from own initiatives"],
    lesson: "A dashboard is useful only when it changes the next decision. Reporting starts with the meeting it needs to improve."
  },
  {
    company: "Myntra", role: "Data Analyst Intern", period: "JAN — JUN 2022", place: "REMOTE",
    problem: "Marketing spend was moving faster than the team’s understanding of where customers were dropping out.",
    responsibility: "Build the conversion story from raw funnel behavior and surface the decisions hiding inside it.",
    built: "A conversion-funnel analysis that connected customer behavior to channel performance and budget choices.",
    automation: "A repeatable analytical view replaced one-off interpretation of the funnel.",
    impact: ["CEO-level budget reallocation", "Full-funnel visibility"],
    lesson: "The sharpest analysis ends in a resource decision—not another chart."
  }
];

export const projects = [
  {
    id: "boardiq", index: "01", name: "BoardIQ", category: "AI DECISION INTELLIGENCE", status: "LIVE", image: "/assets/boardiq.webp", url: "https://investment-analysis-engine.onrender.com",
    thesis: "An investor should never have to trust a verdict they cannot inspect.",
    problem: "Investors have limited time to validate large company datasets. Most AI tools score first and explain later.",
    architecture: ["Decision brief", "Schema guidance", "Data validation", "AI reasoning", "Visible verdict"],
    technology: ["Gemini 2.5", "React", "TypeScript", "Express", "Render"],
    metrics: ["12-screen product", "End-to-end capstone", "Live deployment"],
    roadmap: "Deeper source connectors, audit trails, and reusable investment-committee memos.",
    impact: "Moves data validation upstream so a recommendation is only as confident as the evidence beneath it."
  },
  {
    id: "decco", index: "02", name: "Decco Store", category: "D2C COMMERCE SYSTEM", status: "LIVE", image: "/assets/decco.webp", url: "https://decco-store.lovable.app",
    thesis: "A storefront is a system for learning what people will pay for—not a gallery of products.",
    problem: "Turn aesthetic home products into an impulse-friendly, fast-moving D2C proposition for young Indian buyers.",
    architecture: ["Product selection", "Pricing", "Storefront", "Campaigns", "Physical stall"],
    technology: ["Lovable", "Shopify", "Catalog ops", "Performance marketing"],
    metrics: ["≈₹3 lakh revenue", "30-day build-to-market", "Online + offline"],
    roadmap: "Tighter catalog focus, repeat-purchase loops, and a cleaner fulfillment layer.",
    impact: "Connected product, pricing, promotion, and physical selling into one learning loop."
  },
  {
    id: "wing", index: "03", name: "AI & Analytics Wing", category: "COMMUNITY OPERATING SYSTEM", status: "LIVE", image: "/assets/wing.webp", url: "https://ai-analytics-club-mu.onrender.com/",
    thesis: "A community becomes credible when its work is visible, navigable, and easy to join.",
    problem: "Give the Masters’ Union AI & Analytics Wing a digital home that could carry events, projects, and its point of view.",
    architecture: ["Editorial story", "Programs", "Projects", "Recruitment", "Community proof"],
    technology: ["HTML", "CSS", "JavaScript", "Canvas 2D", "Render"],
    metrics: ["14 design versions", "Built as Wing VP", "Custom canvas visuals"],
    roadmap: "Member work archive, event intelligence, and more reusable operating workflows.",
    impact: "Turned a campus club into a legible platform with a public surface and a stronger recruiting story."
  },
  {
    id: "fitgenie", index: "04", name: "FitGenie AI", category: "AI HEALTH PLATFORM", status: "LIVE", image: null, url: "https://fitgenie-ai-buddy.lovable.app",
    thesis: "Fitness guidance should adapt to the person, not force the person into a template.",
    problem: "Bring nutrition, workouts, progress, and fitness discovery into one personalized experience.",
    architecture: ["User context", "Personalized plan", "Workout loop", "Nutrition", "Progress"],
    technology: ["AI workflows", "Lovable", "Product design"],
    metrics: ["Live product", "Personalized plans", "Unified health loop"],
    roadmap: "Better longitudinal context, adherence signals, and expert escalation.",
    impact: "Makes the health journey feel like one continuous system instead of five disconnected tools."
  },
  {
    id: "shopper", index: "05", name: "Smart Shopper AI", category: "COMMERCE INTELLIGENCE", status: "LIVE", image: null, url: "https://shopper-smartly.lovable.app",
    thesis: "The cheapest option is not always the best decision.",
    problem: "Comparison shopping breaks when price, trust, card offers, delivery time, and quick-commerce availability live in different places.",
    architecture: ["Intent", "Market scan", "Offer normalization", "Trust signals", "Recommendation"],
    technology: ["AI comparison", "Lovable", "Commerce data"],
    metrics: ["E-commerce + quick-commerce", "Multi-factor verdict", "Live product"],
    roadmap: "Live retailer connectors, price history, and personal preference memory.",
    impact: "Reframes shopping from tab-hopping into a decision that weighs the full cost of convenience."
  },
  {
    id: "priya", index: "06", name: "Priya Voice Agent", category: "CONVERSATIONAL AUTOMATION", status: "IN BUILD", image: null, url: null,
    thesis: "The best automation can still sound human when the workflow is designed around the conversation.",
    problem: "Handle two-way customer calls for a dropshipping business without turning every interaction into a script tree.",
    architecture: ["Call trigger", "Voice agent", "Intent handling", "Business action", "Handoff"],
    technology: ["Bolna", "Fish Audio", "Voice cloning", "Workflow design"],
    metrics: ["Two-way voice", "Human handoff designed", "In progress"],
    roadmap: "Finish production guardrails, call analytics, and CRM handoff.",
    impact: "Explores where voice automation can reduce repetitive operations without reducing customer trust."
  }
];

export const thinking = [
  { n: "01", title: "Frame the decision", text: "I start with what must change—not which tool looks interesting. A clear decision gives the system its boundary." },
  { n: "02", title: "Trace the mess", text: "I map inputs, owners, handoffs, exceptions, and delays. Most automation opportunities hide between teams, not inside tasks." },
  { n: "03", title: "Make data earn trust", text: "Before intelligence comes validation: source quality, missing fields, conflicts, and a visible confidence level." },
  { n: "04", title: "Design the loop", text: "A useful AI workflow observes, decides, acts, records what happened, and knows when to ask a human." },
  { n: "05", title: "Ship, measure, tighten", text: "I release the smallest complete loop, watch the failure modes, and turn each exception into a better system." }
];
