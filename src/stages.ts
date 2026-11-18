import type { CarPart } from "./content";

/** Who is test-driving: the role they are hiring for shapes the "why this fits you" lines. */
export type RoleId = "founders" | "strategy" | "data" | "product" | "general";
export const ROLES: { id: RoleId; label: string; hire: string }[] = [
  { id: "founders", label: "Founder's Office / CoS", hire: "Founder's Office" },
  { id: "strategy", label: "Strategy & Ops", hire: "Strategy & Ops" },
  { id: "data", label: "Data & Analytics", hire: "Data / BI" },
  { id: "product", label: "Product", hire: "Product" },
  { id: "general", label: "Something else", hire: "Founder's Office" },
];

export interface Checkpoint { kicker: string; head: string; stat: string; line: string; card?: CarPart }
export interface Stage {
  n: number; title: string; trait: string; emoji: string; color: string; theme: number; themeName: string;
  intro: string; points: [Checkpoint, Checkpoint, Checkpoint]; result: [string, string]; fit: Record<RoleId, string>;
}

/** Four laps, four times of day. Each lap has three checkpoints, then the line where the stage is summed up. */
export const STAGES: Stage[] = [
  {
    n: 1, title: "THE OWNER", trait: "Thinks like an owner", emoji: "🧭", color: "#4fc3f7", theme: 0, themeName: "Dawn",
    intro: "Rabbit Invest, day one. A founder, an idea and not much else.",
    points: [
      { kicker: "DAY ONE", head: "Hire no. 2, a week in", stat: "#2", line: "I joined Rabbit Invest about a week after it started, working straight with the founder.", card: "fuel" },
      { kicker: "THE MVP", head: "Built in 2–3 days", stat: "2–3 days", line: "Researched the exchange, KYC flow and paid APIs with the founder, then built the fund recommendation engine.", card: "fuel" },
      { kicker: "THE BIG CALL", head: "B2C → B2B2C", stat: "B2B2C", line: "Proposed selling the platform to mutual fund distributors for a fixed fee, backed by a competitor teardown and a cost-vs-revenue model.", card: "steering" },
    ],
    result: ["~₹2.5 Cr", "AUM in the app's first year"],
    fit: {
      founders: "You get a second pair of hands from day one: I've sat next to a founder, set up the MVP and argued strategy with numbers.",
      strategy: "I move between strategy and execution: I modelled the pivot, then helped run it.",
      data: "I start from the business decision, so my analysis answers a question instead of decorating a dashboard.",
      product: "I've scoped an MVP with a founder: what to build, what to buy, what to cut.",
      general: "I take ownership early and work directly with leadership.",
    },
  },
  {
    n: 2, title: "THE OPERATOR", trait: "Builds systems that run", emoji: "⚙️", color: "#ffca28", theme: 1, themeName: "Midday",
    intro: "The product works. Now the company has to run without the founder pushing every task.",
    points: [
      { kicker: "FROM ZERO", head: "An ops function, built", stat: "0 → 1", line: "Built operations from nothing: SOPs, owners and a weekly operating rhythm with the founders.", card: "engine" },
      { kicker: "AUTOMATE", head: "The repeat work, gone", stat: "80%", line: "Automated about 80% of recurring manual ops with Python and Apps Script, plus the marketing team's lead flow.", card: "engine" },
      { kicker: "PROMOTED", head: "Associate → Lead", stat: "~18 mo", line: "Promoted from Senior Associate to Lead, Operations & Automation in about 18 months.", card: "engine" },
    ],
    result: ["80%", "of manual operations automated"],
    fit: {
      founders: "I run the machine so the founder doesn't have to: SOPs, reviews and follow-through.",
      strategy: "Strategy lives or dies in operations, and I've built an ops function from zero.",
      data: "I automate the boring 80% so the team spends time on the 20% that needs judgement.",
      product: "I turn messy workflows into systems people actually follow.",
      general: "I make teams faster by removing the repeat work.",
    },
  },
  {
    n: 3, title: "THE DATA BRAIN", trait: "Makes the numbers trustworthy", emoji: "🛡️", color: "#ef5350", theme: 2, themeName: "Sunset",
    intro: "Decisions are only as good as the numbers under them. This is the part most teams skip.",
    points: [
      { kicker: "TRUST", head: "Bad data stopped at the door", stat: "50→95%", line: "Investor data from CAMS, KFin and AMFI went from 50% to 95% accurate once my checks stopped bad rows at the source.", card: "brakes" },
      { kicker: "GROWTH", head: "The funnel, fixed", stat: "5×", line: "Dashboards on the KPIs the sales team used: conversion went from 10% to 50%.", card: "accelerator" },
      { kicker: "WHERE IT STARTED", head: "Myntra and Wipro", stat: "CEO-level", line: "At Myntra my funnel analysis informed a CEO-level budget call; at Wipro I rebuilt CRM reporting for 100+ accounts.", card: "cluster" },
    ],
    result: ["50→95%", "data accuracy, and 5× conversion"],
    fit: {
      founders: "Every number that reaches the founder's desk is one I'd stand behind.",
      strategy: "Your decisions rest on numbers that are actually right.",
      data: "SQL, Python, validation, funnels and dashboards, used on real money and real customers.",
      product: "I instrument funnels and read them, so product calls are backed by evidence.",
      general: "I make data trustworthy, then make it useful.",
    },
  },
  {
    n: 4, title: "THE BUILDER", trait: "Ships, sells and leads", emoji: "🧠", color: "#ab47bc", theme: 3, themeName: "Night",
    intro: "Now at Masters' Union, building after hours: products, a brand and a team.",
    points: [
      { kicker: "SHIPPED AI", head: "Two live products", stat: "2 live", line: "BoardIQ (explainable investment decisions) and NutriSathi (food labels read against your health) are live, built by me.", card: "nav" },
      { kicker: "SOLD BY HAND", head: "Decco Store", stat: "₹3L", line: "Our team's D2C brand sold ₹3 lakh in 30 days: storefront, pricing, campaigns and a stall I ran." },
      { kicker: "LEADING", head: "VP, AI & Analytics Wing", stat: "Round 2", line: "I lead the Wing at Masters' Union, and our team reached Round 2 of The Ken's national case competition." },
    ],
    result: ["Live", "products, a brand and a team"],
    fit: {
      founders: "I take new initiatives end to end: idea, build, launch and sell.",
      strategy: "I can take an initiative from a slide to something live.",
      data: "I go past analysis into AI products people use.",
      product: "Two live AI products, scoped, built and shipped by me.",
      general: "I build, sell and lead, not just analyse.",
    },
  },
];
