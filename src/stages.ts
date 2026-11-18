import type { CarPart } from "./content";

/** Who is test-driving: the role they are hiring for shapes the "why this fits you" lines. */
export type RoleId = "founders" | "strategy" | "data" | "product" | "general";
export const ROLES: { id: RoleId; label: string; hire: string }[] = [
  { id: "founders", label: "Founder's Office / CoS", hire: "Founder's Office" },
  { id: "strategy", label: "Strategy & Ops", hire: "Strategy & Ops" },
  { id: "data", label: "Data & Analytics", hire: "Data / BI" },
  { id: "product", label: "Product", hire: "Product" },
  { id: "general", label: "Generalist / other", hire: "Founder's Office" },
];

export type Mechanic = "decide" | "boost" | "deliver" | "fuel";
export interface Stage {
  n: number; key: Mechanic; title: string; vertical: string; trait: string; emoji: string; color: string;
  theme: number; themeName: string; decor: number; card: CarPart;
  /** what you do on this lap, in one line */
  mission: string;
  /** spoken as the lap starts: the situation */
  intro: string;
  /** spoken at the line: what actually happened */
  outro: string;
  /** what you learned, as three short proofs */
  proof: [string, string][];
  result: [string, string];
  fit: Record<RoleId, string>;
}

/** Four laps, four business functions. Data runs under all of them (the gauges), and gets the last word. */
export const STAGES: Stage[] = [
  {
    n: 1, key: "decide", title: "STRATEGY", vertical: "Strategy", trait: "Decides with the numbers", emoji: "🧭", color: "#4fc3f7",
    theme: 0, themeName: "Dawn", decor: 2, card: "steering",
    mission: "Three forks ahead. The right call gives you a boost; the wrong one slows you down.",
    intro: "Lap one, strategy. Rabbit Invest was a consumer investing app, growing slowly against well-funded rivals. Three decisions are coming up. Pick the lane the numbers support.",
    outro: "I proposed moving Rabbit Invest from B2C to B2B2C: selling the platform to mutual fund distributors for a fixed fee. I backed it with a competitor teardown and a cost versus revenue model.",
    proof: [["B2B2C", "the pivot I proposed and modelled"], ["2–3 days", "to build the fund recommendation engine"], ["#2", "hire, working straight with the founder"]],
    result: ["B2C → B2B2C", "a new direction, with the numbers in hand"],
    fit: {
      founders: "I sit next to a founder and argue strategy with numbers, not opinions.",
      strategy: "I turn a strategic question into a model, then a recommendation the team can act on.",
      data: "My analysis starts from the decision, so it ends in one.",
      product: "I've scoped an MVP with a founder: what to build, what to buy, what to cut.",
      general: "I take ownership early and work directly with leadership.",
    },
  },
  {
    n: 2, key: "boost", title: "MARKETING", vertical: "Marketing & growth", trait: "Moves the number", emoji: "🚀", color: "#ff7043",
    theme: 3, themeName: "Night", decor: 3, card: "accelerator",
    mission: "Target: lift conversion from 10% to 50%. Every booster you hit adds to it.",
    intro: "Lap two, marketing. Leads were coming in, but only one in ten converted. The target is fifty percent. Hit the boosters to get there.",
    outro: "I found where leads were dropping, put those numbers on the sales team's screen and automated the marketing lead flow. Conversion went from ten to fifty percent: five times.",
    proof: [["5×", "sales conversion, 10% → 50%"], ["Auto", "lead flow for the marketing team"], ["₹3L", "Decco Store sales in 30 days"]],
    result: ["5×", "conversion, 10% → 50%"],
    fit: {
      founders: "Give me a target and a funnel; I'll find the leak and fix it.",
      strategy: "I connect growth targets to the levers that actually move them.",
      data: "I build the funnel dashboards that change what the sales team does tomorrow.",
      product: "I read funnels and fix drop-offs, which is half of product work.",
      general: "I hit targets by finding the one number that matters.",
    },
  },
  {
    n: 3, key: "deliver", title: "OPERATIONS", vertical: "Operations", trait: "Builds systems that run", emoji: "⚙️", color: "#ffca28",
    theme: 1, themeName: "Midday", decor: 1, card: "engine",
    mission: "Deliver the orders on time. Do it by hand twice, then watch it run itself.",
    intro: "Lap three, operations. Every order was handled by hand. Deliver the first two yourself. Then I'll show you what I did next.",
    outro: "I built Rabbit Invest's operations from zero: SOPs first, then Python and Apps Script for the repeat work. About eighty percent of manual operations ran themselves, and I was promoted to Lead.",
    proof: [["80%", "of manual ops automated"], ["0 → 1", "ops function, SOPs and reviews"], ["~18 mo", "Senior Associate → Lead"]],
    result: ["80%", "of manual operations automated"],
    fit: {
      founders: "I run the machine so the founder doesn't have to: SOPs, reviews and follow-through.",
      strategy: "Strategy lives or dies in operations, and I've built an ops function from zero.",
      data: "I automate the boring 80% so people spend time on the 20% that needs judgement.",
      product: "I turn messy workflows into systems people actually follow.",
      general: "I make teams faster by removing the repeat work.",
    },
  },
  {
    n: 4, key: "fuel", title: "FINANCE", vertical: "Finance", trait: "Watches every rupee", emoji: "⛽", color: "#66bb6a",
    theme: 2, themeName: "Sunset", decor: 0, card: "fuel",
    mission: "Fuel is runway. Collect the cans to keep going and grow assets under management.",
    intro: "Last lap, finance. Fuel is runway, and it is burning. Every can you collect is money in the tank. The goal is two and a half crore in assets.",
    outro: "With the founder I set up the investing app's MVP and built its fund recommendation engine in two to three days. The app reached about two and a half crore in assets under management in its first year.",
    proof: [["~₹2.5 Cr", "AUM in the app's first year"], ["2–3 days", "fund recommendation engine"], ["Exchange · KYC · APIs", "chosen with the founder"]],
    result: ["~₹2.5 Cr", "AUM in year one"],
    fit: {
      founders: "I think in runway and unit economics, which is how founders think.",
      strategy: "I keep the money side honest: cost, revenue and what it buys.",
      data: "I've built the money pipelines, not just reported on them.",
      product: "I've shipped a fintech MVP and seen it to real assets under management.",
      general: "I treat company money like my own.",
    },
  },
];

/** The last word: data was under every lap. */
export const DATA_FINALE = {
  title: "DATA RAN EVERY LAP",
  intro: "Did you notice the gauges? Speed, fuel, the targets. Data ran every lap. That's how I work.",
  outro: "At Rabbit Invest, investor data was only half right. I built the checks that stop bad rows at the source, and accuracy went from fifty to ninety-five percent. Everything else you just drove through stood on that.",
  proof: [["50→95%", "data accuracy, CAMS · KFin · AMFI"], ["CEO-level", "budget call from my Myntra funnel analysis"], ["100+", "accounts' CRM reporting rebuilt at Wipro"]] as [string, string][],
};
