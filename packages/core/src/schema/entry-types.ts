/**
 * Discriminated union of all valid entry types in a Proof Chain.
 * Used instead of an enum per code standards.
 */
export const ENTRY_TYPES = [
  "ai_decision",
  "human_override",
  "system_event",
  "policy_check",
  "data_access",
  "model_deployment",
  "feedback",
  "correction",
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

/**
 * Discriminated union of AI decision subtypes.
 */
export const DECISION_TYPES = [
  "classification",
  "generation",
  "recommendation",
  "extraction",
  "summarization",
  "translation",
  "embedding",
  "tool_call",
  "routing",
  "other",
] as const;

export type DecisionType = (typeof DECISION_TYPES)[number];
