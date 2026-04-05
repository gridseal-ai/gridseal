/**
 * Runtime enforcement engine for authority boundary policies.
 * Checks incoming actions against a parsed policy and returns allow/gate/escalate/deny.
 */

import type { RiskLevel, Sector, DataType } from "../types.js";
import type {
  AuthorityPolicy,
  ActionRule,
  ActionConditions,
  ActionRequest,
  EnforcementResult,
  RuleCategory,
  PolicyDecision,
} from "./types.js";

/** Maps a rule category to the enforcement decision it produces. */
const CATEGORY_DECISIONS: Record<RuleCategory, PolicyDecision> = {
  autonomous: "allow",
  gated: "gate",
  escalated: "escalate",
};

/** Maps a rule category to a human-readable description for the reason field. */
const CATEGORY_DESCRIPTIONS: Record<RuleCategory, string> = {
  autonomous: "Action permitted as autonomous (no approval required)",
  gated: "Action requires human approval before execution",
  escalated: "Action exceeds agent authority and must be escalated",
};

function matchesConditions(request: ActionRequest, conditions: ActionConditions | undefined): boolean {
  if (conditions === undefined) return true;

  if (conditions.sectors !== undefined && conditions.sectors.length > 0) {
    if (request.sector === undefined) return false;
    if (!conditions.sectors.includes(request.sector as Sector)) return false;
  }

  if (conditions.riskLevels !== undefined && conditions.riskLevels.length > 0) {
    if (request.riskLevel === undefined) return false;
    if (!conditions.riskLevels.includes(request.riskLevel as RiskLevel)) return false;
  }

  if (conditions.dataTypes !== undefined && conditions.dataTypes.length > 0) {
    if (request.dataType === undefined) return false;
    if (!conditions.dataTypes.includes(request.dataType as DataType)) return false;
  }

  if (conditions.minConfidenceScore !== undefined) {
    if (request.confidenceScore === undefined) return false;
    if (request.confidenceScore < conditions.minConfidenceScore) return false;
  }

  if (conditions.maxConfidenceScore !== undefined) {
    if (request.confidenceScore === undefined) return false;
    if (request.confidenceScore > conditions.maxConfidenceScore) return false;
  }

  return true;
}

function findMatchingRule(
  rules: ReadonlyArray<ActionRule>,
  request: ActionRequest,
): ActionRule | null {
  for (const rule of rules) {
    if (rule.actionType !== request.actionType) continue;
    if (matchesConditions(request, rule.conditions)) return rule;
  }
  return null;
}

/**
 * Enforces an authority boundary policy against an incoming action request.
 * Checks categories in priority order: escalated > gated > autonomous.
 * If no rule matches, applies the policy's default decision.
 */
export function enforcePolicy(
  policy: AuthorityPolicy,
  request: ActionRequest,
): EnforcementResult {
  const timestamp = new Date().toISOString();

  const categories: ReadonlyArray<RuleCategory> = ["escalated", "gated", "autonomous"];

  for (const category of categories) {
    const rules = policy[category];
    const matchedRule = findMatchingRule(rules, request);
    if (matchedRule !== null) {
      return {
        decision: CATEGORY_DECISIONS[category],
        matchedRule,
        category,
        reason: `${CATEGORY_DESCRIPTIONS[category]}: ${matchedRule.actionType}`,
        timestamp,
      };
    }
  }

  return {
    decision: policy.defaultDecision,
    matchedRule: null,
    category: "default",
    reason: `No matching rule found for action "${request.actionType}"; applying default decision: ${policy.defaultDecision}`,
    timestamp,
  };
}

/**
 * Creates a Proof Chain entry tags record from an enforcement result.
 * Used to attach enforcement decisions to audit trail entries.
 */
export function enforcementToTags(result: EnforcementResult): Record<string, string> {
  const tags: Record<string, string> = {
    "authority.decision": result.decision,
    "authority.category": result.category,
    "authority.reason": result.reason,
    "authority.timestamp": result.timestamp,
  };

  if (result.matchedRule !== null) {
    tags["authority.matchedAction"] = result.matchedRule.actionType;
  }

  return tags;
}
