import type { CarPart } from "./content";

/** Who is test-driving: the role they are hiring for shapes the "why this fits you" line. */
export type RoleId = "founders" | "strategy" | "data" | "product" | "general";
export const ROLES: { id: RoleId; label: string; hire: string }[] = [
  { id: "founders", label: "Founder's Office / CoS", hire: "Founder's Office" },
  { id: "strategy", label: "Strategy & Ops", hire: "Strategy & Ops" },
  { id: "data", label: "Data & Analytics", hire: "Data / BI" },
  { id: "product", label: "Product", hire: "Product" },
  { id: "general", label: "Generalist / other", hire: "Founder's Office" },
];

/** A spoken line. `key` names the recording that can replace the built-in voice (assets/voice/<key>.mp3). */
export interface Line { key: string; text: string }

export interface Choice { id: string; label: string; sub: string; best?: boolean; outcome: Line }
export type Mechanic = "road" | "funnel" | "orders" | "runway";
export interface Activity {
  n: number; key: Mechanic; title: string; vertical: string; trait: string; emoji: string; color: string;
  theme: number; themeName: string; decor: number; card: CarPart;
  /** the world this activity is set in */
  world: string;
  /** the founder's call you make before driving */
  question: Line;
  choices: Choice[];
  /** one line on screen while you drive */
  objective: string;
  /** what this function means, what I did, what came of it: short lines, spoken one by one */
  explain: Line[];
  result: [string, string];
  fit: Record<RoleId, string>;
}

/** Four business functions, one short activity each (10–20 seconds of driving). Data sits under all of them. */
export const ACTIVITIES: Activity[] = [
  {
    n: 1, key: "road", title: "STRATEGY", vertical: "Strategy", trait: "Picks the right road", emoji: "🧭", color: "#4fc3f7",
    theme: 0, themeName: "Dawn", decor: 2, card: "steering", world: "🌲 Mountain forest · dawn",
    question: { key: "strategy-q", text: "Your app grows slowly. Funded rivals own the main road. Which way do you go?" },
    choices: [
      { id: "flat", label: "Flat highway", sub: "Fight the rivals head-on", outcome: { key: "strategy-flat", text: "Fast road. But every funded rival is on it." } },
      { id: "mud", label: "Muddy road", sub: "Keep grinding the same way", outcome: { key: "strategy-mud", text: "Safe, but slow. You burn time and money." } },
      { id: "mountain", label: "Mountain pass", sub: "A new model: B2B2C", best: true, outcome: { key: "strategy-mountain", text: "A hard climb. Then the road is yours." } },
    ],
    objective: "Your road. Reach the market lead.",
    explain: [
      { key: "strategy-1", text: "Strategy is choosing where to compete." },
      { key: "strategy-2", text: "At Rabbit Invest, rivals out-spent us on consumers." },
      { key: "strategy-3", text: "I proposed B2B2C: sell to fund distributors instead." },
      { key: "strategy-4", text: "I backed it with a cost and revenue model." },
    ],
    result: ["B2C → B2B2C", "the pivot I proposed and modelled"],
    fit: {
      founders: "I argue strategy with numbers, right next to the founder.",
      strategy: "I turn a big question into a model and a clear call.",
      data: "My analysis starts from a decision, so it ends in one.",
      product: "I know when to change the road, not just drive faster.",
      general: "I take the hard call early, with evidence.",
    },
  },
  {
    n: 2, key: "funnel", title: "MARKETING", vertical: "Marketing & sales", trait: "Finds the leak", emoji: "🚀", color: "#ff7043",
    theme: 3, themeName: "Night", decor: 3, card: "accelerator", world: "🌃 Neon city · night",
    question: { key: "marketing-q", text: "Leads come in, but nine in ten never buy. What do you do first?" },
    choices: [
      { id: "ads", label: "Buy more ads", sub: "Pour more leads in", outcome: { key: "marketing-ads", text: "More leads. Same leak. Still ten percent." } },
      { id: "leak", label: "Find the leak", sub: "See where they drop off", best: true, outcome: { key: "marketing-leak", text: "Three leaks found. Hit each fix." } },
    ],
    objective: "Hit the boosters. Land on 50%.",
    explain: [
      { key: "marketing-1", text: "Marketing is finding where people drop off." },
      { key: "marketing-2", text: "Our leads were leaking after the first call." },
      { key: "marketing-3", text: "I put that number on the sales team's screen." },
      { key: "marketing-4", text: "Conversion went from 10 to 50 percent." },
    ],
    result: ["5×", "conversion, 10% → 50%"],
    fit: {
      founders: "Give me a target; I'll find the one number blocking it.",
      strategy: "I tie growth targets to the levers that move them.",
      data: "My dashboards change what the team does tomorrow.",
      product: "I read funnels and fix drop-offs.",
      general: "I hit targets by fixing the leak, not the spend.",
    },
  },
  {
    n: 3, key: "orders", title: "OPERATIONS", vertical: "Operations", trait: "Keeps it running", emoji: "⚙️", color: "#ffca28",
    theme: 1, themeName: "Midday", decor: 1, card: "engine", world: "🏭 Ops yard · midday",
    question: { key: "ops-q", text: "Problems keep hitting the road. Late trucks, stock-outs, bad data. What do you do?" },
    choices: [
      { id: "fire", label: "Firefight each one", sub: "Fix it by hand, every time", outcome: { key: "ops-fire", text: "You fix each one. Then hit the next." } },
      { id: "auto", label: "SOP, then automate", sub: "Fix the process once", best: true, outcome: { key: "ops-auto", text: "Fix the first by hand. Then the system steers." } },
    ],
    objective: "Keep it running. Problems ahead.",
    explain: [
      { key: "ops-1", text: "Operations is making work repeatable." },
      { key: "ops-2", text: "I wrote the SOPs first, then automated them." },
      { key: "ops-3", text: "Eighty percent of manual work ran on its own." },
      { key: "ops-4", text: "I went from Senior Associate to Lead." },
    ],
    result: ["80%", "of manual operations automated"],
    fit: {
      founders: "I run the machine, so the founder doesn't have to.",
      strategy: "I've built an ops function from zero.",
      data: "I automate the boring part, so people do the thinking.",
      product: "I turn messy workflows into systems people follow.",
      general: "I make teams faster by removing repeat work.",
    },
  },
  {
    n: 4, key: "runway", title: "FINANCE", vertical: "Finance", trait: "Makes the runway last", emoji: "⛽", color: "#66bb6a",
    theme: 2, themeName: "Sunset", decor: 0, card: "fuel", world: "🏜️ Desert · sunset",
    question: { key: "finance-q", text: "Fuel is runway, and you're at thirty percent. What keeps you going?" },
    choices: [
      { id: "burn", label: "Floor it", sub: "Spend fast to grow fast", outcome: { key: "finance-burn", text: "Fast for a while. Then the tank runs dry." } },
      { id: "aum", label: "Grow what we manage", sub: "Assets that keep paying", best: true, outcome: { key: "finance-aum", text: "Every rupee managed refills the tank." } },
    ],
    objective: "Make the fuel last. Reach ₹2.5 Cr.",
    explain: [
      { key: "finance-1", text: "Finance is making the runway last." },
      { key: "finance-2", text: "I set up our investing app with the founder." },
      { key: "finance-3", text: "I built its fund engine in two to three days." },
      { key: "finance-4", text: "It reached two and a half crore in assets, in year one." },
    ],
    result: ["~₹2.5 Cr", "AUM in year one"],
    fit: {
      founders: "I think in runway and unit economics, like a founder.",
      strategy: "I keep cost, revenue and returns honest.",
      data: "I've built money pipelines, not just reports on them.",
      product: "I've shipped a fintech MVP to real assets.",
      general: "I treat company money like my own.",
    },
  },
];

/** The last word: data was under every activity. */
export const DATA_FINALE = {
  title: "DATA RAN EVERY STEP",
  lines: [
    { key: "data-1", text: "Every number you watched on the road was data." },
    { key: "data-2", text: "At Rabbit Invest, investor data was half right." },
    { key: "data-3", text: "I built checks that stop bad data at the source." },
    { key: "data-4", text: "Accuracy went from 50 to 95 percent." },
  ] as Line[],
  proof: [["50→95%", "data accuracy, CAMS · KFin · AMFI"], ["CEO-level", "budget call from my Myntra funnel analysis"], ["100+", "accounts' CRM reporting rebuilt at Wipro"]] as [string, string][],
};

/** kept for the garage's own summary card */
export const STAGES = ACTIVITIES.map((a) => ({ ...a, result: a.result }));
