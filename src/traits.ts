import type { GateId } from "./scene/track";
import { STAGES } from "./stages";

/** One line per stage: what a visitor ends up knowing about me. */
export interface Trait { gate: GateId; emoji: string; color: string; trait: string; stat: string; statLabel: string; line: string; aha: string }
const SLOT: GateId[] = ["steering", "engine", "brakes", "nav"];
export const TRAITS: Trait[] = STAGES.map((s, i) => ({ gate: SLOT[i], emoji: s.emoji, color: s.color, trait: s.trait, stat: s.result[0], statLabel: s.result[1], line: s.intro, aha: s.points[0].line }));
export const traitFor = (g: GateId) => TRAITS.find((t) => t.gate === g);
