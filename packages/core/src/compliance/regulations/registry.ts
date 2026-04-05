import type { Regulation } from "../types.js";
import { coloradoSb205 } from "./colorado-sb205.js";
import { nistAiRmf } from "./nist-ai-rmf.js";
import { euAiAct } from "./eu-ai-act.js";
import { hipaaAudit } from "./hipaa-audit.js";

/** All registered regulations, keyed by regulation ID. */
const REGULATION_MAP: ReadonlyMap<string, Regulation> = new Map([
  [coloradoSb205.regulationId, coloradoSb205],
  [nistAiRmf.regulationId, nistAiRmf],
  [euAiAct.regulationId, euAiAct],
  [hipaaAudit.regulationId, hipaaAudit],
]);

/** Get all registered regulations. */
export function getAllRegulations(): ReadonlyArray<Regulation> {
  return Array.from(REGULATION_MAP.values());
}

/** Get a regulation by its ID. Returns undefined if not found. */
export function getRegulationById(regulationId: string): Regulation | undefined {
  return REGULATION_MAP.get(regulationId);
}

/** Get all regulation IDs. */
export function getRegulationIds(): ReadonlyArray<string> {
  return Array.from(REGULATION_MAP.keys());
}
