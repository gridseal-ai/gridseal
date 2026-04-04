export type {
  ProofChainEntry,
  CreateEntryInput,
  HashableEntryFields,
  Tier1Fields,
  Tier2Fields,
  Tier3Fields,
} from "./schema/proof-chain-entry.js";

export {
  TIER_2_DEFAULTS,
  TIER_3_DEFAULTS,
} from "./schema/proof-chain-entry.js";

export type { EntryType, DecisionType } from "./schema/entry-types.js";
export { ENTRY_TYPES, DECISION_TYPES } from "./schema/entry-types.js";

export type { Result } from "./schema/result.js";
export { ok, err } from "./schema/result.js";

export {
  sha256,
  canonicalize,
  computeEntryHash,
  serializeForHashing,
} from "./chain/hash.js";
