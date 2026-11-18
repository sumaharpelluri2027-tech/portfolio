import type { GateId } from "./scene/track";
import { STAGES } from "./stages";

/** One line per stage: what a visitor ends up knowing about me. */
export interface Trait { gate: GateId; emoji: string; color: string; trait: string; stat: string; statLabel: string; line: string; aha: string }
const SLOT: GateId[] = ["steering", "accelerator", "engine", "fuel"];
export const TRAITS: Trait[] = STAGES.map((s, i) => ({ gate: SLOT[i], emoji: s.emoji, color: s.color, trait: s.trait, stat: s.result[0], statLabel: s.result[1], line: s.outro, aha: s.proof[0][1] }));
export const traitFor = (g: GateId) => TRAITS.find((t) => t.gate === g);
