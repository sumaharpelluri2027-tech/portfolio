import type { GateId } from "./scene/track";
import { PROJECTS } from "./projects";

/** What a visitor "collects" at each of the four gates: one thing I bring, one proof, one fact. */
export interface Trait { gate: GateId; emoji: string; color: string; trait: string; stat: string; statLabel: string; line: string; chips: string[]; aha: string }
export const TRAITS: Trait[] = [
  { gate: "steering", emoji: "🧭", color: "#4fc3f7", trait: "Thinks like an owner", stat: "~₹2.5 Cr", statLabel: "AUM in the app's first year", line: "Founding team at Rabbit Invest: I set up the MVP with the founder, then proposed and modelled the move from B2C to B2B2C.", chips: ["Strategy", "Unit economics"], aha: "I was about the 2nd hire, a week after Rabbit Invest started." },
  { gate: "accelerator", emoji: "🚀", color: "#ff7043", trait: "Moves the number", stat: "5×", statLabel: "sales conversion, 10% → 50%", line: "I found where leads were dropping and put that number on the team's screen.", chips: ["Funnels", "Dashboards"], aha: "Decco sold ₹3 lakh in 30 days, some of it at a stall I ran." },
  { gate: "brakes", emoji: "🛡️", color: "#ef5350", trait: "Fixes data, automates the rest", stat: "50→95%", statLabel: "data accuracy · 80% of manual ops automated", line: "Checks that stop bad data before anyone builds on it, then Python and Apps Script for the repeat work.", chips: ["Data quality", "Automation"], aha: "Promoted from Senior Associate to Lead in about 18 months." },
  { gate: "nav", emoji: "🧠", color: "#ab47bc", trait: "Ships AI people can trust", stat: String(PROJECTS.length), statLabel: "projects, cases and live builds", line: "BoardIQ and NutriSathi are live; our team made Round 2 of The Ken's national case competition.", chips: ["AI products", "Builder"], aha: "NutriSathi reads your own blood report to judge a food." },
];
export const traitFor = (g: GateId) => TRAITS.find((t) => t.gate === g);
