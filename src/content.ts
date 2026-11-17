import { LINKS } from "./data";

/** Everything you can click in the garage. Car parts first, then the garage props. */
export type StationId =
  | "steering" | "accelerator" | "engine" | "brakes" | "fuel" | "nav" | "cluster"
  | "toolchest" | "trophies" | "crew" | "decco" | "board" | "driver" | "shipped" | "prototypes" | "laptop" | "radio" | "clipboard" | "powerbox" | "scanner" | "exit" | "journey";

export type CarPart = "steering" | "accelerator" | "engine" | "brakes" | "fuel" | "nav" | "cluster";

/** One line of the "under the bonnet" layer: what the data plumbing looked like. */
export interface Wiring {
  pipeline: string[];          // left-to-right flow
  snippetLang: string;
  snippet: string;             // a sketch of the approach, not production code
  note: string;
}

export interface JobCard {
  id: CarPart;
  no: string;                  // job card number
  part: string;                // the car part
  area: string;                // business area it stands for
  hover: string;               // short label shown on hover
  title: string;
  where: string;
  complaint: string;           // the problem
  work: string;                // what I did
  did?: string[];              // the same, as three short lines
  result: { big: string; label: string };
  extra?: string;
  tools: string[];
  links?: [string, string][];
  wiring: Wiring;
}

export const JOBS: Record<CarPart, JobCard> = {
  brakes: {
    id: "brakes", no: "01", part: "Brakes", area: "Data trust", hover: "Brakes · data you can trust",
    title: "The system that stops bad data before it moves",
    did: ["Pulled CAMS, KFin and AMFI data into one pipeline", "Wrote the checks that stop bad rows before they move", "Put a dashboard on top so ops could trust it"],
    where: "Rabbit Invest · Operations & Automation Lead · 2024–2026",
    complaint: "Investor data arrived split across three registrars. Accuracy sat at 50–60%, and the ops team absorbed the doubt by hand.",
    work: "Built ingestion, validation and QC across CAMS, KFin and AMFI, with reconciliation scripts and KPI dashboards on top. I designed the braking system on our BAJA car; this is the same job for data.",
    result: { big: "50→95%", label: "data accuracy" },
    tools: ["Python", "Pandas", "SQL", "Validation rules", "Looker"],
    wiring: {
      pipeline: ["CAMS", "KFin", "AMFI", "Ingest", "Validate", "QC", "95% trusted"],
      snippetLang: "python",
      snippet: `# sketch of the approach
rows = load_all(["cams", "kfin", "amfi"])
checks = [no_nulls("pan", "folio"),
          no_dupes("folio", "scheme"),
          units_match_nav(tolerance=0.01)]
bad = run(checks, rows)
quarantine(bad)          # never reaches the dashboard
publish(rows - bad)`,
      note: "Every rule that rejects a row writes why, so the team fixes sources, not symptoms.",
    },
  },
  engine: {
    id: "engine", no: "02", part: "Engine", area: "Operations", hover: "Engine · operations",
    title: "An ops function that runs without being pushed",
    did: ["Wrote the SOPs first", "Automated the repeat work with Python and Apps Script", "Ran operating reviews with the founders"],
    where: "Rabbit Invest · founding member, about the second hire",
    complaint: "A new fintech with no operations function: every recurring task was manual, and errors came back every week.",
    work: "Wrote the SOPs first, then automated them with Python, Google Apps Script and REST APIs. Ran founder-level operating reviews on the numbers.",
    result: { big: "80%", label: "of recurring manual ops automated" },
    extra: "Execution efficiency up 200%.",
    tools: ["SOP design", "Python", "Apps Script", "REST APIs", "KPI governance"],
    wiring: {
      pipeline: ["SOP", "Trigger", "Script", "Sheet / DB", "Alert", "Review"],
      snippetLang: "javascript",
      snippet: `// sketch: Apps Script on a time trigger
function nightlyRun() {
  const jobs = Sheet("SOP").rows().filter(r => r.auto);
  jobs.forEach(j => {
    const res = run(j);
    if (!res.ok) notify(j.owner, res.error);
    log(j.id, res);
  });
}`,
      note: "The SOP decides what gets automated. If a step has no owner, it does not get a script.",
    },
  },
  accelerator: {
    id: "accelerator", no: "03", part: "Accelerator", area: "Growth", hover: "Accelerator · growth",
    title: "A funnel that finally converted",
    did: ["Built dashboards on the KPIs sales used", "Automated the marketing team's lead flow", "Ran pricing and campaigns at Decco Store"],
    where: "Rabbit Invest · and Decco Store",
    complaint: "Leads came in, but nobody could see where they dropped out, and the marketing team moved leads by hand.",
    work: "Wired dashboards to the KPIs sales actually triaged from, and automated the marketing team's lead flow on my own initiative. At Decco Store I picked products, set prices and ran the campaigns.",
    result: { big: "5×", label: "sales conversion, 10% → 50%" },
    extra: "Decco Store: ₹3 lakh revenue in its first 30 days.",
    tools: ["Funnel analysis", "Looker", "Lead automation", "Pricing", "Shopify"],
    links: [["Decco Store", LINKS.decco]],
    wiring: {
      pipeline: ["Lead source", "CRM", "Stage events", "Funnel view", "Drop-off alert"],
      snippetLang: "sql",
      snippet: `-- sketch: where leads stall
SELECT stage,
       COUNT(*)                         AS leads,
       AVG(hours_in_stage)              AS avg_wait,
       1 - LEAD(COUNT(*)) OVER w
           / COUNT(*)::float            AS drop_off
FROM lead_stage_events
GROUP BY stage
WINDOW w AS (ORDER BY stage_order);`,
      note: "The dashboard only shows the stage with the biggest drop-off first. Everything else is one click deeper.",
    },
  },
  steering: {
    id: "steering", no: "04", part: "Steering", area: "Strategy", hover: "Steering · strategy",
    title: "Changing direction with the numbers in hand",
    did: ["Compared competitor products", "Modelled cost against revenue", "Proposed selling to fund distributors for a fixed fee"],
    where: "Rabbit Invest · founding team",
    complaint: "A B2C investing app growing slowly against well-funded competitors.",
    work: "Proposed and analysed the shift from B2C to B2B2C: offering the platform to mutual fund distributors for a fixed fee. I compared competitor products and modelled cost against revenue.",
    result: { big: "B2C → B2B2C", label: "the shift I proposed and analysed" },
    tools: ["Competitor teardown", "Unit economics", "Cost vs revenue model", "Memo"],
    wiring: {
      pipeline: ["Competitors", "Cost model", "Revenue model", "Scenarios", "Recommendation"],
      snippetLang: "text",
      snippet: `sketch: the comparison that drove the call

            cost to serve   revenue per   who carries
                            account       acquisition
  B2C       high            low           us
  B2B2C     low             fixed fee     distributor`,
      note: "A strategy call is a spreadsheet with a decision at the bottom.",
    },
  },
  fuel: {
    id: "fuel", no: "05", part: "Fuel tank", area: "Finance", hover: "Fuel · finance",
    title: "Money in the tank",
    did: ["Researched the MVP setup with the founder", "Built the fund recommendation engine in 2–3 days", "Exchange, KYC flow and APIs chosen"],
    where: "Rabbit Invest · the B2C app's first year",
    complaint: "A fund platform needs a reason for investors to put money in, from day one.",
    work: "Researched the MVP setup with the founder (exchange choice, KYC flow, paid API integrations) and built the mutual fund recommendation engine in Google Sheets and Apps Script in two to three days.",
    result: { big: "~₹2.5 Cr", label: "AUM in the B2C app's first year" },
    tools: ["Mutual funds", "Google Sheets", "Apps Script", "KYC flow", "APIs"],
    wiring: {
      pipeline: ["Investor profile", "Risk score", "Fund universe", "Filter + rank", "Basket"],
      snippetLang: "javascript",
      snippet: `// sketch: recommendation engine in Sheets
const score = riskScore(profile);
const picks = funds
  .filter(f => f.riskBand === band(score))
  .sort((a, b) => b.consistency - a.consistency)
  .slice(0, 4);
return weights(picks, profile.horizon);`,
      note: "Built in days, not months, so the founder could test it with real investors.",
    },
  },
  nav: {
    id: "nav", no: "06", part: "Navigation", area: "AI products", hover: "Navigation · AI you can inspect",
    title: "BoardIQ: an AI that shows its route",
    did: ["Starts from the decision you need to make", "Checks if your data can be trusted first", "Gives a verdict with its full reasoning"],
    where: "AI in Business capstone · Masters' Union",
    complaint: "Investors are asked to trust AI verdicts they can't inspect.",
    work: "Built BoardIQ end to end: it starts from the decision, says what data it needs, checks whether that data can be trusted, then gives a verdict with its full reasoning chain and a board memo.",
    result: { big: "12 screens", label: "objective to board memo, live" },
    tools: ["Gemini 2.5", "React", "TypeScript", "Express", "Render"],
    links: [["Open BoardIQ", LINKS.boardiq]],
    wiring: {
      pipeline: ["Objective", "Data spec", "Upload", "Validate", "Gemini", "Verdict", "Why?"],
      snippetLang: "text",
      snippet: `the order matters:
  1. decision first     what are you deciding?
  2. data spec          which fields, which periods
  3. trust check        nulls, duplicates, outliers
  4. model              only on data that passed
  5. reasoning chain    evidence → metric → risk`,
      note: "The trust check sits before the model. That is the whole product.",
    },
  },
  cluster: {
    id: "cluster", no: "07", part: "Gauges", area: "Where the data habit started", hover: "Gauges · reporting",
    title: "Gauges that change the next decision",
    did: ["Myntra: funnel analysis built from scratch", "Wipro: rebuilt Zoho CRM reporting", "Wipro: acquisition and retention analysis"],
    where: "Myntra · Data Analyst Intern, 2022 · Wipro · Project Engineer, 2022–2024",
    complaint: "Marketing spend moved faster than the team's view of where customers dropped out. Later, at Wipro, 100+ SMB accounts had no clear funnel signal.",
    work: "At Myntra I built a conversion-funnel analysis from scratch linking behaviour to channel performance. At Wipro I rebuilt Zoho CRM reporting and the acquisition and retention analysis.",
    result: { big: "CEO-level", label: "budget reallocation from my Myntra analysis" },
    extra: "Wipro: +40% pipeline visibility, +50% retention funnel, +30% revenue on my own initiatives.",
    tools: ["Funnel analysis", "Zoho CRM", "Excel", "SQL", "Data quality"],
    wiring: {
      pipeline: ["Sessions", "Channel", "Funnel steps", "Drop-off", "Budget call"],
      snippetLang: "text",
      snippet: `a gauge earns its place only if it answers:
  what changed?        vs last period
  where?               channel × funnel step
  so what?             which budget moves`,
      note: "If a chart doesn't change a decision, it comes off the dashboard.",
    },
  },
};

export const CAR_ORDER: CarPart[] = ["brakes", "engine", "accelerator", "steering", "fuel", "nav", "cluster"];

export interface PropInfo { id: Exclude<StationId, CarPart>; label: string; hint: string }
export const PROPS: PropInfo[] = [
  { id: "driver", label: "Driver poster", hint: "About me" },
  { id: "board", label: "Build board", hint: "Every MU project, case and live product" },
  { id: "crew", label: "Pit crew wall", hint: "The AI & Analytics Wing" },
  { id: "decco", label: "Decco Store board", hint: "₹3L in 30 days, sold by hand" },
  { id: "toolchest", label: "Tool chest", hint: "What I actually work with" },
  { id: "trophies", label: "Trophy shelf", hint: "Milestones" },
  { id: "shipped", label: "Shipped crate", hint: "Live products you can open" },
  { id: "prototypes", label: "Prototype box", hint: "Builds still in progress" },
  { id: "laptop", label: "Laptop", hint: "Ask Sumahar AI" },
  { id: "radio", label: "Radio", hint: "Play my track" },
  { id: "clipboard", label: "Clipboard", hint: "The spec sheet · plain résumé view" },
  { id: "powerbox", label: "Power box", hint: "Lift the bonnet: see the data wiring" },
  { id: "scanner", label: "Diagnostic scanner", hint: "Run a diagnostic on your company" },
  { id: "journey", label: "Road map", hint: "My career journey, stop by stop" },
  { id: "exit", label: "Garage door", hint: "Out to the test track: drive the buggy" },
];

/** Diagnostic: the visitor's symptom → the part I'd look at first. */
export const SYMPTOMS: { id: string; text: string; part: CarPart; code: string; first: string[] }[] = [
  { id: "trust", text: "Our numbers don't match across teams", part: "brakes", code: "P0950",
    first: ["List every source feeding the number", "Write the rules a good row must pass", "Quarantine what fails, with the reason", "Publish only what passed, with a confidence level"] },
  { id: "manual", text: "Ops runs on spreadsheets and people", part: "engine", code: "P0800",
    first: ["Write the SOP for the top five recurring tasks", "Give every step an owner", "Automate the steps that repeat weekly", "Alert on exceptions, review the rest weekly"] },
  { id: "funnel", text: "Leads come in but don't convert", part: "accelerator", code: "P0510",
    first: ["Log every stage change with a timestamp", "Find the stage with the biggest drop-off", "Fix the hand-off there first", "Put that one number on the founder's screen"] },
  { id: "direction", text: "We need a strategy call backed by data", part: "steering", code: "P0420",
    first: ["Write the decision as one question", "Build cost and revenue for each option", "Compare against two competitors", "Recommend, with what would change my mind"] },
  { id: "ai", text: "We want AI, but can't trust its answers", part: "nav", code: "P0606",
    first: ["Start from the decision, not the model", "Spec the data it needs", "Check that data before the model sees it", "Show the reasoning next to every answer"] },
];
