import { LINKS } from "./data";

export type Kind = "live" | "case" | "course" | "proto" | "lead";
export const KINDS: { id: Kind | "all"; label: string; blurb: string }[] = [
  { id: "all", label: "Everything", blurb: "Every build, case and project in one place." },
  { id: "live", label: "Live products", blurb: "Things you can open and use today." },
  { id: "case", label: "Case competitions", blurb: "National and campus competitions at Masters' Union." },
  { id: "course", label: "MU course projects", blurb: "Team projects from the PGP-TBM curriculum." },
  { id: "proto", label: "Prototypes", blurb: "Ventures and builds still in progress." },
  { id: "lead", label: "Leadership", blurb: "Running the AI & Analytics Wing and campaigns." },
];

export interface Project {
  id: string; title: string; kind: Kind; status: string; hot?: boolean;
  what: string;            // what it is
  mine: string;            // what I did
  number?: string;         // only numbers already on record
  href?: string; cta?: string; img?: string; where: string;
}

export const PROJECTS: Project[] = [
  // ---------- live products ----------
  { id: "boardiq", title: "BoardIQ", kind: "live", status: "Live", hot: true, where: "MU · AI in Business capstone",
    what: "An investment decision platform that checks whether your data can be trusted before its AI gives a verdict, then shows the full reasoning chain and a board memo.",
    mine: "Designed and built it end to end: 12 screens, Gemini reasoning, React + TypeScript on Render.",
    number: "12 screens", href: LINKS.boardiq, cta: "Open BoardIQ", img: "img/boardiq.jpg" },
  { id: "nutrisathi", title: "NutriSathi (FoodTruth AI)", kind: "live", status: "Live", hot: true, where: "MU · AI business project",
    what: "Scan a packaged food and see what you're actually buying: claims, ingredients and nutrition explained, for fitness-focused buyers.",
    mine: "Built and shipped it on Next.js, Supabase and Vercel, with small improvements going live daily.",
    href: "https://nutrisathi.app", cta: "Open NutriSathi" },
  { id: "wing-site", title: "AI & Analytics Wing website", kind: "live", status: "Live", where: "MU · AI & Analytics Wing",
    what: "The Wing's public home: an editorial story, a decision game and the team network with custom Canvas visuals.",
    mine: "Designed and built every version myself.", number: "14 versions", href: LINKS.wing, cta: "Visit the site", img: "img/aiaw-site.jpg" },
  { id: "decco", title: "Decco Store", kind: "live", status: "₹3L in 30 days", hot: true, where: "MU · venture, with a team",
    what: "A vintage-inspired home and speaker brand, sold online and at our own stall.",
    mine: "Shopify setup, the Lovable storefront, the product catalogue, pricing and campaigns, then selling in person.",
    number: "₹3L revenue, first 30 days", href: LINKS.decco, cta: "Visit the store", img: "img/decco-shot.jpg" },
  { id: "fitgenie", title: "FitGenie AI", kind: "live", status: "Live", where: "Side build",
    what: "Personalised nutrition and workout plans, progress tracking and fitness discovery in one loop.",
    mine: "Product and build.", href: "https://fitgenie-ai-buddy.lovable.app", cta: "Try it", img: "img/fitgenie.jpg" },
  { id: "shopper", title: "Smart Shopper AI", kind: "live", status: "Live", where: "Side build",
    what: "Compares price, seller trust, card offers and delivery speed across e-commerce and quick commerce.",
    mine: "Product and build.", href: "https://shopper-smartly.lovable.app", cta: "Try it", img: "img/shopper.jpg" },

  // ---------- case competitions ----------
  { id: "arogya", title: "Arogya · The Ken's Great Rewiring", kind: "case", status: "Round 2 shortlist", hot: true, where: "The Ken Case Competition 2026",
    what: "An agentic AI for family health that reorders medicine for a parent living in another city, with check-up scheduling as the next use case.",
    mine: "Designed the agent and the solution with my team; our Round 1 entry was shortlisted for Round 2." },
  { id: "case-union", title: "Case Union 4.0 problem statements", kind: "case", status: "4 shortlisted", hot: true, where: "MU's national case competition · for the Wing",
    what: "AI problem statements that make teams design real AI systems instead of treating AI as background strategy.",
    mine: "Led the Wing's proposals through several feedback rounds.", number: "4 shortlisted in Phase 1" },
  { id: "vantage", title: "Vantage 2026", kind: "case", status: "Presented on campus", where: "MUCC national case competition",
    what: "A consulting case for Masters' Union Consulting Club's national competition, as Team C Rockers.",
    mine: "Built the Round 1 deck with my teammate and handled the panel's Q&A." },
  { id: "gambit", title: "Gambit 2026 · SwiftByte", kind: "case", status: "Competed", where: "CommerceX case competition",
    what: "A 10-minute food delivery case: which option the company should bet on.",
    mine: "Worked the numbers myself and defended our option to the team with data." },
  { id: "gostops", title: "goSTOPS revenue recovery", kind: "case", status: "One-day challenge", where: "MU one-day challenge",
    what: "A plan to recover the July–September quarter's revenue, built on three demand segments and an ancillary revenue engine.",
    mine: "Chose to reject an upmarket pivot to keep the brand's Gen-Z focus." },
  { id: "perfora", title: "Perfora statistics challenge", kind: "case", status: "One-day challenge", where: "MU statistics challenge",
    what: "Tested the hypothesis that acquisition quality and retention cap a D2C oral-care brand's website revenue.",
    mine: "Framed the hypothesis and built the deck around the evidence." },

  // ---------- MU course projects ----------
  { id: "thrive", title: "Thrive · go-to-market", kind: "course", status: "Macro Project", where: "MU · GTM strategy for a disruptive startup",
    what: "A clean-label, high-protein milk-mix for kids aged 3–15, positioned against sugary malt drinks and low-protein 'healthy' brands.",
    mine: "Team project: need gap, market scan, STP, marketing mix and the launch plan." },
  { id: "wowmomo", title: "Wow! Momo · next big bet", kind: "course", status: "Team pitch", where: "MU · FMCG challenge",
    what: "Which category Wow! Momo FMCG should enter next, with the business case.",
    mine: "When most teams went for chips, I pivoted our idea to veggie and chicken biscuit chips." },
  { id: "wowskin", title: "WOW Skin Science", kind: "course", status: "Marketing Sandbox", where: "MU · Marketing Sandbox",
    what: "Diagnosing the brand's marketing challenge through consumer research.",
    mine: "Team project: research and diagnosis." },
  { id: "dhl", title: "DHL · business strategy", kind: "course", status: "Strategy case", where: "MU · Business Strategy",
    what: "Acting as consultants: industry analysis, DHL's positioning and competitive advantage, and one recommendation with projections.",
    mine: "Team project." },
  { id: "fnb", title: "Decoding F&B", kind: "course", status: "Pitched", where: "MU · venture pitch",
    what: "Fusion condiments: Chilli Crisp × Tadka and a Kokum hot sauce.",
    mine: "Cut 16 slides down to six for a five-minute panel." },
  { id: "kinfolio", title: "Kinfolio", kind: "course", status: "Business model", where: "MU · business model assignment",
    what: "A financial legacy and family-continuity platform.", mine: "Built the model and the regulatory research behind it." },
  { id: "trustmrr", title: "TrustMRR EDA", kind: "course", status: "Completed", where: "MU · graded executive presentation",
    what: "Exploratory analysis of a SaaS startup dataset.", mine: "Ran the analysis and wrote it up as a consulting-style executive summary." },
  { id: "insurance", title: "AI Insurance Claim Assistant", kind: "course", status: "Completed", where: "MU · group assignment",
    what: "Claims-processing automation in Make.com, with a sector map of Indian insurtech.", mine: "Built the automation." },
  { id: "ikshana", title: "IKSHANA Z INC", kind: "course", status: "Adopted by client", hot: true, where: "Incorporation analysis",
    what: "A multi-state incorporation analysis on tax and permits.", mine: "The client adopted my Delaware recommendation." },

  // ---------- prototypes ----------
  { id: "priya", title: "Priya · AI voice agent", kind: "proto", status: "In build", where: "Side build",
    what: "A two-way call agent for a dropshipping business, on Bolna with a Fish Audio cloned voice.", mine: "Designing it with the human handoff first." },
  { id: "snip", title: "Snip", kind: "proto", status: "Prototype", where: "Venture",
    what: "A marketplace and CRM connecting people with tailors, boutiques and designers across India.", mine: "Built the first prototype on Lovable." },
  { id: "brew", title: "Brew Home", kind: "proto", status: "Prototype", where: "Side build",
    what: "A specialty Indian coffee storefront with a flavour quiz that recommends a roast, plus subscriptions.", mine: "Product and build.", img: "img/brewhome.jpg" },

  // ---------- leadership ----------
  { id: "wing", title: "VP, AI & Analytics Wing", kind: "lead", status: "Elected", hot: true, where: "Masters' Union",
    what: "Running the Wing: events, case challenges, recruitment and partnerships.",
    mine: "Ran the event \"Turning Business Challenges into AI Opportunities\" with a QR feedback system, and built the core-team recruitment workbook.", img: "img/aiaw-event.jpg" },
  { id: "film", title: "The campaign film", kind: "lead", status: "AI film", where: "Wing election",
    what: "My first AI film, made with Google Flow: the campaign that got me elected VP of the Wing.", mine: "Wrote and generated it.", href: LINKS.film, cta: "Watch on YouTube" },
  { id: "campaigns", title: "FOCOS & Google Fraternity campaigns", kind: "lead", status: "Campaigns", where: "Masters' Union",
    what: "Campaigns for FOCOS Club President and Google Fraternity President.", mine: "Wrote the scripts, decks and campaign material." },
];

export const count = (k: Kind | "all") => (k === "all" ? PROJECTS.length : PROJECTS.filter((p) => p.kind === k).length);
