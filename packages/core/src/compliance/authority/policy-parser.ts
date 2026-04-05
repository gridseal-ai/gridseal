/**
 * Parses and validates YAML authority boundary policies.
 * Returns a Result so callers handle parse failures without exceptions.
 */

import { parse as parseYaml } from "yaml";
import type { Result } from "../../schema/result.js";
import { ok, err } from "../../schema/result.js";
import { SECTORS, RISK_LEVELS, DATA_TYPES } from "../types.js";
import type { AuthorityPolicy, ActionRule, ActionConditions, PolicyDecision } from "./types.js";
import { POLICY_DECISIONS } from "./types.js";

/** Error returned when YAML policy parsing or validation fails. */
export type PolicyParseError = {
  readonly type: "INVALID_YAML" | "VALIDATION_ERROR";
  readonly message: string;
};

const SECTOR_SET = new Set<string>(SECTORS);
const RISK_LEVEL_SET = new Set<string>(RISK_LEVELS);
const DATA_TYPE_SET = new Set<string>(DATA_TYPES);
const DECISION_SET = new Set<string>(POLICY_DECISIONS);

function validateConditions(
  conditions: unknown,
  path: string,
): Result<ActionConditions, PolicyParseError> {
  if (typeof conditions !== "object" || conditions === null) {
    return err({ type: "VALIDATION_ERROR", message: `${path}: conditions must be an object` });
  }

  const cond = conditions as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  if (cond["sectors"] !== undefined) {
    if (!Array.isArray(cond["sectors"])) {
      return err({ type: "VALIDATION_ERROR", message: `${path}.sectors: must be an array` });
    }
    for (const s of cond["sectors"] as ReadonlyArray<unknown>) {
      if (typeof s !== "string" || !SECTOR_SET.has(s)) {
        return err({ type: "VALIDATION_ERROR", message: `${path}.sectors: invalid sector "${String(s)}"` });
      }
    }
    result["sectors"] = cond["sectors"];
  }

  if (cond["riskLevels"] !== undefined) {
    if (!Array.isArray(cond["riskLevels"])) {
      return err({ type: "VALIDATION_ERROR", message: `${path}.riskLevels: must be an array` });
    }
    for (const r of cond["riskLevels"] as ReadonlyArray<unknown>) {
      if (typeof r !== "string" || !RISK_LEVEL_SET.has(r)) {
        return err({ type: "VALIDATION_ERROR", message: `${path}.riskLevels: invalid risk level "${String(r)}"` });
      }
    }
    result["riskLevels"] = cond["riskLevels"];
  }

  if (cond["dataTypes"] !== undefined) {
    if (!Array.isArray(cond["dataTypes"])) {
      return err({ type: "VALIDATION_ERROR", message: `${path}.dataTypes: must be an array` });
    }
    for (const d of cond["dataTypes"] as ReadonlyArray<unknown>) {
      if (typeof d !== "string" || !DATA_TYPE_SET.has(d)) {
        return err({ type: "VALIDATION_ERROR", message: `${path}.dataTypes: invalid data type "${String(d)}"` });
      }
    }
    result["dataTypes"] = cond["dataTypes"];
  }

  if (cond["minConfidenceScore"] !== undefined) {
    if (typeof cond["minConfidenceScore"] !== "number" || cond["minConfidenceScore"] < 0 || cond["minConfidenceScore"] > 1) {
      return err({ type: "VALIDATION_ERROR", message: `${path}.minConfidenceScore: must be a number between 0 and 1` });
    }
    result["minConfidenceScore"] = cond["minConfidenceScore"];
  }

  if (cond["maxConfidenceScore"] !== undefined) {
    if (typeof cond["maxConfidenceScore"] !== "number" || cond["maxConfidenceScore"] < 0 || cond["maxConfidenceScore"] > 1) {
      return err({ type: "VALIDATION_ERROR", message: `${path}.maxConfidenceScore: must be a number between 0 and 1` });
    }
    result["maxConfidenceScore"] = cond["maxConfidenceScore"];
  }

  return ok(result as ActionConditions);
}

function validateRuleList(
  rules: unknown,
  category: string,
): Result<ReadonlyArray<ActionRule>, PolicyParseError> {
  if (!Array.isArray(rules)) {
    return err({ type: "VALIDATION_ERROR", message: `${category}: must be an array` });
  }

  const validated: Array<ActionRule> = [];

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i] as unknown;
    if (typeof rule !== "object" || rule === null) {
      return err({ type: "VALIDATION_ERROR", message: `${category}[${i}]: must be an object` });
    }

    const ruleObj = rule as Record<string, unknown>;

    if (typeof ruleObj["actionType"] !== "string" || ruleObj["actionType"].length === 0) {
      return err({ type: "VALIDATION_ERROR", message: `${category}[${i}].actionType: must be a non-empty string` });
    }

    let conditions: ActionConditions | undefined;
    if (ruleObj["conditions"] !== undefined) {
      const condResult = validateConditions(ruleObj["conditions"], `${category}[${i}].conditions`);
      if (!condResult.ok) return condResult;
      conditions = condResult.value;
    }

    validated.push({
      actionType: ruleObj["actionType"],
      ...(conditions !== undefined ? { conditions } : {}),
    });
  }

  return ok(validated);
}

/** Parses a YAML string into a validated AuthorityPolicy. */
export function parsePolicy(yaml: string): Result<AuthorityPolicy, PolicyParseError> {
  let parsed: unknown;
  try {
    parsed = parseYaml(yaml);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown YAML parse error";
    return err({ type: "INVALID_YAML", message: `Failed to parse YAML: ${message}` });
  }

  if (typeof parsed !== "object" || parsed === null) {
    return err({ type: "VALIDATION_ERROR", message: "Policy must be a YAML object" });
  }

  const doc = parsed as Record<string, unknown>;

  if (typeof doc["version"] !== "string" || doc["version"].length === 0) {
    return err({ type: "VALIDATION_ERROR", message: "version: must be a non-empty string" });
  }

  const defaultDecision = doc["defaultDecision"];
  if (typeof defaultDecision !== "string" || !DECISION_SET.has(defaultDecision)) {
    return err({
      type: "VALIDATION_ERROR",
      message: `defaultDecision: must be one of ${POLICY_DECISIONS.join(", ")}`,
    });
  }

  const autonomousResult = validateRuleList(
    doc["autonomous"] !== undefined ? doc["autonomous"] : [],
    "autonomous",
  );
  if (!autonomousResult.ok) return autonomousResult;

  const gatedResult = validateRuleList(
    doc["gated"] !== undefined ? doc["gated"] : [],
    "gated",
  );
  if (!gatedResult.ok) return gatedResult;

  const escalatedResult = validateRuleList(
    doc["escalated"] !== undefined ? doc["escalated"] : [],
    "escalated",
  );
  if (!escalatedResult.ok) return escalatedResult;

  return ok({
    version: doc["version"],
    defaultDecision: defaultDecision as PolicyDecision,
    autonomous: autonomousResult.value,
    gated: gatedResult.value,
    escalated: escalatedResult.value,
  });
}
