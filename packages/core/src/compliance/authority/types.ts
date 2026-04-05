/**
 * Types for the authority boundary enforcement engine.
 * Defines policy structures for autonomous, gated, and escalated actions.
 */

import type { RiskLevel, Sector, DataType } from "../types.js";

/** Possible enforcement decisions for an action. */
export const POLICY_DECISIONS = ["allow", "gate", "escalate", "deny"] as const;
export type PolicyDecision = (typeof POLICY_DECISIONS)[number];

/** Categories an action rule can belong to in the policy. */
export const RULE_CATEGORIES = ["autonomous", "gated", "escalated"] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

/** Conditions that narrow when an action rule applies. */
export type ActionConditions = {
  readonly sectors?: ReadonlyArray<Sector> | undefined;
  readonly riskLevels?: ReadonlyArray<RiskLevel> | undefined;
  readonly dataTypes?: ReadonlyArray<DataType> | undefined;
  readonly minConfidenceScore?: number | undefined;
  readonly maxConfidenceScore?: number | undefined;
};

/** A single rule within an authority policy. */
export type ActionRule = {
  readonly actionType: string;
  readonly conditions?: ActionConditions | undefined;
};

/** The full authority boundary policy parsed from YAML. */
export type AuthorityPolicy = {
  readonly version: string;
  readonly defaultDecision: PolicyDecision;
  readonly autonomous: ReadonlyArray<ActionRule>;
  readonly gated: ReadonlyArray<ActionRule>;
  readonly escalated: ReadonlyArray<ActionRule>;
};

/** An incoming action to be checked against the policy. */
export type ActionRequest = {
  readonly actionType: string;
  readonly sector?: Sector | undefined;
  readonly riskLevel?: RiskLevel | undefined;
  readonly dataType?: DataType | undefined;
  readonly confidenceScore?: number | undefined;
};

/** The result of enforcing a policy on an action request. */
export type EnforcementResult = {
  readonly decision: PolicyDecision;
  readonly matchedRule: ActionRule | null;
  readonly category: RuleCategory | "default";
  readonly reason: string;
  readonly timestamp: string;
};
