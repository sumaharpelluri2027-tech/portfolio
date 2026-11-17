import type { GateId } from "./scene/track";
import { PROJECTS } from "./projects";

/** What a visitor "collects" at each gate: one trait about me, one proof, one line. */
export interface Trait { gate: GateId; emoji: string; color: string; trait: string; stat: string; statLabel: string; line: string; chips: string[]; aha: string }
export const TRAITS: Trait[] = [
  { gate: "steering", emoji: "🧭", color: "#4fc3f7", trait: "Thinks like an owner", stat: "B2C→B2B2C", statLabel: "pivot I proposed and modelled", line: "I compared competitors, modelled cost against revenue and brought the founders a new direction.", chips: ["Strategy", "Unit economics"], aha: "I was about the 2nd hire, a week after Rabbit Invest started." },
  { gate: "accelerator", emoji: "🚀", color: "#ff7043", trait: "Moves the number", stat: "5×", statLabel: "sales conversion, 10% → 50%", line: "I found where leads were dropping and put that number on the team's screen.", chips: ["Funnels", "Dashboards"], aha: "Decco sold ₹3 lakh in 30 days, some of it at a stall I ran." },
  { gate: "engine", emoji: "⚙️", color: "#ffca28", trait: "Builds systems that run alone", stat: "80%", statLabel: "of manual ops automated", line: "SOPs first, then Python and Apps Script. Founding member, ops built from zero.", chips: ["Ops", "Automation"], aha: "Promoted from Senior Associate to Lead in about 18 months." },
  { gate: "fuel", emoji: "⛽", color: "#66bb6a", trait: "Ships fast when it counts", stat: "~₹2.5 Cr", statLabel: "AUM in the app's first year", line: "I built the fund recommendation engine in two to three days.", chips: ["Finance", "MVP"], aha: "I chose the exchange, KYC flow and APIs with the founder." },
  { gate: "brakes", emoji: "🛡️", color: "#ef5350", trait: "Fixes data at the source", stat: "50→95%", statLabel: "data accuracy", line: "Validation checks that stop bad data before anyone builds on it.", chips: ["Data quality", "SQL · Python"], aha: "I designed the brakes on a real BAJA buggy (AIR 8). Same job, for data." },
  { gate: "nav", emoji: "🧠", color: "#ab47bc", trait: "Builds AI people can trust", stat: "Live", statLabel: "BoardIQ and NutriSathi", line: "AI that checks its inputs and shows its reasoning, shipped and used.", chips: ["Gemini", "React"], aha: "NutriSathi reads your own blood report to judge a food." },
  { gate: "projects", emoji: "🏗️", color: "#26c6da", trait: "Never stops building", stat: String(PROJECTS.length), statLabel: "projects, cases and builds at MU and beyond", line: "Five live products, a national Round 2 and ₹3 lakh in sales in 30 days.", chips: ["Builder", "Team player"], aha: "Our team made Round 2 of The Ken's national case competition." },
];
export const traitFor = (g: GateId) => TRAITS.find((t) => t.gate === g);
