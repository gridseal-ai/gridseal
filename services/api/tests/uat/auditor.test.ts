/**
 * UAT Layer 4: Auditor Perspective
 *
 * Simulates a compliance auditor querying a realistic 30-day audit trail.
 * 500 entries across 5 models, 3 sessions (with parent-child trees),
 * mixed review statuses, reasoning certificates, and tool-call entries.
 * Every assertion checks real API responses against expected values.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTenantApp } from "../../src/app.js";
import { createTenantSqliteAdapter } from "../../src/db/tenant-sqlite-adapter.js";
import { createTenantToken } from "../../src/jwt.js";
import type { Hono } from "hono";
import type { TenantSqliteHandle } from "../../src/db/tenant-sqlite-adapter.js";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const JWT_SECRET = "auditor-uat-secret";
const TENANT = "auditor-tenant";
const CHAIN_ID = "auditor-chain";

const MODELS = [
  { id: "gpt-4o", provider: "openai" },
  { id: "claude-sonnet-4-20250514", provider: "anthropic" },
  { id: "gemini-1.5-pro", provider: "google" },
  { id: "llama-3.1-70b", provider: "meta" },
  { id: "mistral-large-2", provider: "mistral" },
] as const;

const SESSIONS = ["session-alpha", "session-beta", "session-gamma"] as const;

const DECISION_TYPES = [
  "classification",
  "generation",
  "recommendation",
  "extraction",
  "summarization",
  "translation",
  "tool_call",
  "routing",
] as const;

const REVIEW_STATUSES = ["approved", "pending", "rejected", "escalated"] as const;

const AUTHORITY_LEVELS = [
  "autonomous",
  "human_in_the_loop",
  "human_on_the_loop",
  "advisory",
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function authHeader(): { Authorization: string } {
  return { Authorization: `Bearer ${createTenantToken(TENANT, JWT_SECRET)}` };
}

function jsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", ...authHeader() };
}

/** Deterministic pseudo-random for repeatable tests. */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function sha256Hex(prefix: string, index: number): string {
  const hex = index.toString(16).padStart(8, "0");
  return (prefix + hex).padEnd(64, "0");
}

/** Generate a deterministic UUID v4-like string from a namespace and index. */
function deterministicUuid(ns: string, index: number): string {
  // Use a simple hash to distribute bits across the UUID
  const nsCode = Array.from(ns).reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0) >>> 0;
  const a = ((nsCode ^ (index * 2654435761)) >>> 0).toString(16).padStart(8, "0");
  const b = ((nsCode ^ (index * 2246822519 + 1)) >>> 0).toString(16).padStart(8, "0");
  const c = ((nsCode ^ (index * 3266489917 + 2)) >>> 0).toString(16).padStart(8, "0");
  const d = ((nsCode ^ (index * 668265263 + 3)) >>> 0).toString(16).padStart(8, "0");
  const raw = a + b + c + d;
  return [
    raw.slice(0, 8),
    raw.slice(8, 12),
    "4" + raw.slice(13, 16),
    "8" + raw.slice(17, 20),
    raw.slice(20, 32),
  ].join("-");
}

/** Generate a date within a 30-day window from a base date. */
function dateInRange(base: Date, dayOffset: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(
    Math.floor(dayOffset * 7) % 24,
    Math.floor(dayOffset * 13) % 60,
    Math.floor(dayOffset * 37) % 60,
    0,
  );
  return d.toISOString();
}

/* ------------------------------------------------------------------ */
/*  Scenario data                                                      */
/* ------------------------------------------------------------------ */

type ScenarioEntry = {
  entryId: string;
  timestamp: string;
  entryType: string;
  modelId: string;
  modelProvider: string;
  sessionId: string;
  parentEntryId: string | null;
  decisionType: string;
  confidenceScore: number;
  inputHash: string;
  outputHash: string;
  actorId: string;
  reasoningCertificateId: string | null;
  provenanceId: string | null;
  tags: Record<string, string>;
  annotation: string | null;
  complianceMetadata: Record<string, unknown>;
  policyIds: string[];
};

type CertificatePayload = {
  certificateId: string;
  timestamp: string;
  modelId: string;
  modelProvider: string;
  claims: Array<{
    claimId: string;
    statement: string;
    supportingEvidenceIds: string[];
  }>;
  supportingEvidence: Array<{
    evidenceId: string;
    evidenceType: string;
    description: string;
    source: string | null;
  }>;
  unsupportedClaims: Array<{ statement: string; reason: string }>;
  assumptions: Array<{ statement: string; criticality: string }>;
  limitations: Array<{ description: string; impact: string }>;
  confidenceAssessment: {
    level: string;
    score: number;
    rationale: string;
  };
};

type ProvenancePayload = {
  provenanceId: string;
  timestamp: string;
  bomVersion: string;
  modelName: string;
  modelVersion: string;
  modelType: string;
  modelProvider: string;
  modelDescription: string | null;
  modelAuthor: string | null;
  modelLicense: string | null;
  trainingDatasets: Array<{
    datasetId: string;
    name: string;
    version: string | null;
    source: string | null;
    description: string | null;
  }>;
  performanceMetrics: Array<{
    metricId: string;
    name: string;
    value: number;
    slice: string | null;
    confidenceInterval: { lower: number; upper: number } | null;
  }>;
  ethicalConsiderations: Array<{
    category: string;
    description: string;
    mitigationStrategy: string | null;
  }>;
  externalReferences: Array<{
    referenceType: string;
    url: string;
    description: string | null;
  }>;
};

function buildScenario(): {
  entries: ScenarioEntry[];
  certificates: CertificatePayload[];
  provenances: ProvenancePayload[];
  sessionRoots: Record<string, string>;
} {
  const rand = seededRandom(42);
  const baseDate = new Date("2026-03-01T00:00:00.000Z");
  const entries: ScenarioEntry[] = [];
  const certificates: CertificatePayload[] = [];
  const provenances: ProvenancePayload[] = [];
  const sessionRoots: Record<string, string> = {};

  // Map model IDs to provenance UUIDs
  const modelProvenanceMap = new Map<string, string>();
  for (let mi = 0; mi < MODELS.length; mi++) {
    modelProvenanceMap.set(MODELS[mi].id, deterministicUuid("prov", mi));
  }

  // Create provenance records for each model
  for (let mi = 0; mi < MODELS.length; mi++) {
    const model = MODELS[mi];
    const provId = modelProvenanceMap.get(model.id) as string;
    provenances.push({
      provenanceId: provId,
      timestamp: baseDate.toISOString(),
      bomVersion: "1.7",
      modelName: model.id,
      modelVersion: "2025-01",
      modelType: "generative",
      modelProvider: model.provider,
      modelDescription: `${model.id} language model`,
      modelAuthor: model.provider,
      modelLicense: "proprietary",
      trainingDatasets: [
        {
          datasetId: `ds-${model.id}`,
          name: "WebCorpus",
          version: "3.0",
          source: null,
          description: "Large web text corpus",
        },
      ],
      performanceMetrics: [
        {
          metricId: `perf-${model.id}`,
          name: "accuracy",
          value: 0.85 + rand() * 0.1,
          slice: null,
          confidenceInterval: { lower: 0.82, upper: 0.92 },
        },
      ],
      ethicalConsiderations: [
        {
          category: "bias",
          description: "Evaluated for demographic bias",
          mitigationStrategy: "RLHF debiasing",
        },
      ],
      externalReferences: [
        {
          referenceType: "model_card",
          url: `https://example.com/${model.id}/card`,
          description: "Model card",
        },
      ],
    });
  }

  // Certificate UUID map
  const certUuids: string[] = [];
  for (let c = 0; c < 50; c++) {
    certUuids.push(deterministicUuid("cert", c));
  }

  // Create 50 reasoning certificates
  for (let c = 0; c < 50; c++) {
    const model = MODELS[c % MODELS.length];
    const hasUnsupported = c % 5 === 0; // 10 out of 50 have unsupported claims
    certificates.push({
      certificateId: certUuids[c],
      timestamp: dateInRange(baseDate, (c / 50) * 30),
      modelId: model.id,
      modelProvider: model.provider,
      claims: [
        {
          claimId: `claim-${c}-1`,
          statement: `Primary claim for decision ${c}`,
          supportingEvidenceIds: [`ev-${c}-1`],
        },
        {
          claimId: `claim-${c}-2`,
          statement: `Secondary claim for decision ${c}`,
          supportingEvidenceIds: [`ev-${c}-1`],
        },
      ],
      supportingEvidence: [
        {
          evidenceId: `ev-${c}-1`,
          evidenceType: "data",
          description: `Evidence for decision ${c}`,
          source: "internal-system",
        },
      ],
      unsupportedClaims: hasUnsupported
        ? [
            {
              statement: `Unsupported claim in cert ${c}`,
              reason: "Insufficient supporting data",
            },
          ]
        : [],
      assumptions: [
        {
          statement: `Input data is complete for decision ${c}`,
          criticality: "high",
        },
      ],
      limitations: [
        {
          description: `Limited to English text for cert ${c}`,
          impact: "Moderate",
        },
      ],
      confidenceAssessment: {
        level: c % 3 === 0 ? "high" : c % 3 === 1 ? "medium" : "low",
        score: 0.5 + rand() * 0.5,
        rationale: `Assessment for decision ${c}`,
      },
    });
  }

  // Entry UUID map
  const entryUuids: string[] = [];
  for (let i = 0; i < 500; i++) {
    entryUuids.push(deterministicUuid("entr", i));
  }

  // Create 500 entries over 30 days
  for (let i = 0; i < 500; i++) {
    const model = MODELS[i % MODELS.length];
    const sessionIdx = i < 200 ? 0 : i < 350 ? 1 : 2;
    const session = SESSIONS[sessionIdx];
    const dayOffset = (i / 500) * 30;
    const entryId = entryUuids[i];

    // Determine parent-child structure: first entry per session is root
    let parentEntryId: string | null = null;
    if (!(session in sessionRoots)) {
      sessionRoots[session] = entryId;
    } else if (i % 10 === 0) {
      // Every 10th entry is a direct child of the session root
      parentEntryId = sessionRoots[session];
    } else if (i % 10 === 1 && i > 10) {
      // Some entries are children of the previous "10th" entry
      parentEntryId = entryUuids[i - 1];
    }

    // Review status distribution: 60% approved, 20% pending, 10% rejected, 10% escalated
    const rv = rand();
    const reviewStatus: string =
      rv < 0.6 ? "approved" : rv < 0.8 ? "pending" : rv < 0.9 ? "rejected" : "escalated";

    // Authority level
    const authorityLevel = AUTHORITY_LEVELS[i % AUTHORITY_LEVELS.length];

    // Reasoning certificate for first 50 entries
    const certId = i < 50 ? certUuids[i] : null;

    // Provenance for every 5th entry
    const provId = i % 5 === 0 ? (modelProvenanceMap.get(model.id) as string) : null;

    // Decision type: entries 400-499 use tool_call to simulate "100 entries with tool_calls"
    const decisionType =
      i >= 400
        ? "tool_call"
        : DECISION_TYPES[i % DECISION_TYPES.length];

    // Entry type
    const entryType =
      reviewStatus === "escalated"
        ? "human_override"
        : i % 20 === 0
          ? "system_event"
          : i % 15 === 0
            ? "policy_check"
            : "ai_decision";

    const escalationTrigger =
      reviewStatus === "escalated"
        ? `Low confidence threshold breach at entry ${i}`
        : null;

    entries.push({
      entryId,
      timestamp: dateInRange(baseDate, dayOffset),
      entryType,
      modelId: model.id,
      modelProvider: model.provider,
      sessionId: session,
      parentEntryId,
      decisionType,
      confidenceScore: 0.3 + rand() * 0.7,
      inputHash: sha256Hex("a", i),
      outputHash: sha256Hex("b", i),
      actorId: `actor-${(i % 3) + 1}`,
      reasoningCertificateId: certId,
      provenanceId: provId,
      tags: {
        review_status: reviewStatus,
        authority_level: authorityLevel,
        ...(escalationTrigger
          ? { escalation_trigger: escalationTrigger }
          : {}),
      },
      annotation:
        reviewStatus === "escalated"
          ? `Escalated: ${escalationTrigger}`
          : null,
      complianceMetadata: {
        sectors: ["healthcare", "finance"],
        riskLevel: "high",
        authorityLevel,
      },
      policyIds: i % 3 === 0 ? ["policy-risk-mgmt", "policy-data-gov"] : [],
    });
  }

  return { entries, certificates, provenances, sessionRoots };
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                         */
/* ------------------------------------------------------------------ */

describe("UAT: Auditor perspective - 30-day realistic audit trail", () => {
  let dbHandle: TenantSqliteHandle;
  let app: Hono;
  let scenario: ReturnType<typeof buildScenario>;

  beforeAll(async () => {
    dbHandle = createTenantSqliteAdapter();
    app = createTenantApp({
      storageFactory: dbHandle.forTenant,
      jwtSecret: JWT_SECRET,
    });
    scenario = buildScenario();

    // Seed provenance records
    for (const prov of scenario.provenances) {
      const res = await app.request("/provenance", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(prov),
      });
      if (res.status !== 201) {
        const errBody = await res.json();
        throw new Error(
          `Failed to seed provenance ${prov.provenanceId}: ${res.status} ${JSON.stringify(errBody)}`,
        );
      }
    }

    // Seed reasoning certificates
    for (const cert of scenario.certificates) {
      const res = await app.request("/certificates", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(cert),
      });
      expect(res.status).toBe(201);
    }

    // Seed all 500 entries sequentially (chain ordering matters)
    for (const entry of scenario.entries) {
      const res = await app.request(`/chains/${CHAIN_ID}/entries`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(entry),
      });
      if (res.status !== 201) {
        const body = await res.json();
        throw new Error(
          `Failed to seed entry ${entry.entryId}: ${res.status} ${JSON.stringify(body)}`,
        );
      }
    }
  }, 120000);

  afterAll(() => {
    dbHandle.close();
  });

  /* ---------------------------------------------------------------- */
  /*  Query 1: Filter by model and date range                         */
  /* ---------------------------------------------------------------- */

  describe("Auditor Query 1: entries for model X between date A and date B", () => {
    it("returns only gpt-4o entries within the first 15-day window", async () => {
      const targetModel = "gpt-4o";
      const startDate = "2026-03-01T00:00:00.000Z";
      const endDate = "2026-03-16T00:00:00.000Z";

      const res = await app.request(
        `/chains/${CHAIN_ID}/entries?modelId=${targetModel}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&limit=500`,
        { headers: authHeader() },
      );
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        entries: Array<{ modelId: string; timestamp: string }>;
        total: number;
      };

      // Compute expected count from scenario data
      const expected = scenario.entries.filter(
        (e) =>
          e.modelId === targetModel &&
          e.timestamp >= startDate &&
          e.timestamp <= endDate,
      );

      expect(body.total).toBe(expected.length);
      expect(body.entries).toHaveLength(Math.min(expected.length, 500));

      // Every returned entry must match the filters
      for (const entry of body.entries) {
        expect(entry.modelId).toBe(targetModel);
        expect(entry.timestamp >= startDate).toBe(true);
        expect(entry.timestamp <= endDate).toBe(true);
      }
    });

    it("returns zero entries for a model not in the chain", async () => {
      const res = await app.request(
        `/chains/${CHAIN_ID}/entries?modelId=nonexistent-model&limit=100`,
        { headers: authHeader() },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { total: number };
      expect(body.total).toBe(0);
    });

    it("filters by each of the 5 models and totals match 500", async () => {
      let grandTotal = 0;
      for (const model of MODELS) {
        const res = await app.request(
          `/chains/${CHAIN_ID}/entries?modelId=${model.id}&limit=500`,
          { headers: authHeader() },
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { total: number };
        const expectedCount = scenario.entries.filter(
          (e) => e.modelId === model.id,
        ).length;
        expect(body.total).toBe(expectedCount);
        grandTotal += body.total;
      }
      expect(grandTotal).toBe(500);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Query 2: Decision tree for a session                             */
  /* ---------------------------------------------------------------- */

  describe("Auditor Query 2: decision tree for session", () => {
    it("retrieves complete subtree from session root with correct parent-child links", async () => {
      const rootId = scenario.sessionRoots["session-alpha"];
      const subtreeRes = await app.request(
        `/chains/${CHAIN_ID}/entries/${rootId}/subtree`,
        { headers: authHeader() },
      );
      expect(subtreeRes.status).toBe(200);

      const subtreeBody = (await subtreeRes.json()) as {
        rootEntryId: string;
        entries: Array<{
          entryId: string;
          parentEntryId: string | null;
          sessionId: string;
        }>;
      };

      expect(subtreeBody.rootEntryId).toBe(rootId);
      expect(subtreeBody.entries.length).toBeGreaterThan(0);

      // Root entry must be in subtree
      const rootEntry = subtreeBody.entries.find((e) => e.entryId === rootId);
      expect(rootEntry).toBeDefined();

      // Every non-root entry in subtree must have parentEntryId pointing to
      // another entry in the subtree (no orphans)
      const subtreeIds = new Set(subtreeBody.entries.map((e) => e.entryId));
      for (const entry of subtreeBody.entries) {
        if (entry.entryId === rootId) continue;
        if (entry.parentEntryId !== null) {
          expect(subtreeIds.has(entry.parentEntryId)).toBe(true);
        }
      }
    });

    it("retrieves direct children of session root", async () => {
      const rootId = scenario.sessionRoots["session-alpha"];
      const childrenRes = await app.request(
        `/chains/${CHAIN_ID}/entries/${rootId}/children`,
        { headers: authHeader() },
      );
      expect(childrenRes.status).toBe(200);

      const childrenBody = (await childrenRes.json()) as {
        children: Array<{ entryId: string; parentEntryId: string }>;
      };

      // Every child must reference the root as parent
      for (const child of childrenBody.children) {
        expect(child.parentEntryId).toBe(rootId);
      }

      // Count should match scenario
      const expectedChildren = scenario.entries.filter(
        (e) => e.parentEntryId === rootId,
      );
      expect(childrenBody.children).toHaveLength(expectedChildren.length);
    });

    it("verifies no cycles in parent-child relationships", async () => {
      // Fetch all session-alpha entries
      const res = await app.request(
        `/chains/${CHAIN_ID}/entries?sessionId=session-alpha&limit=500`,
        { headers: authHeader() },
      );
      const body = (await res.json()) as {
        entries: Array<{
          entryId: string;
          parentEntryId: string | null;
        }>;
      };

      // Build adjacency map
      const parentOf = new Map<string, string | null>();
      for (const e of body.entries) {
        parentOf.set(e.entryId, e.parentEntryId);
      }

      // Walk each entry to root; detect cycles via visited set
      for (const e of body.entries) {
        const visited = new Set<string>();
        let current: string | null = e.entryId;
        while (current !== null) {
          expect(visited.has(current)).toBe(false);
          visited.add(current);
          current = parentOf.get(current) ?? null;
        }
      }
    });

    it("filters entries by each session and totals match 500", async () => {
      let total = 0;
      for (const session of SESSIONS) {
        const res = await app.request(
          `/chains/${CHAIN_ID}/entries?sessionId=${session}&limit=500`,
          { headers: authHeader() },
        );
        const body = (await res.json()) as { total: number };
        const expected = scenario.entries.filter(
          (e) => e.sessionId === session,
        ).length;
        expect(body.total).toBe(expected);
        total += body.total;
      }
      expect(total).toBe(500);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Query 3: Chain integrity verification                            */
  /* ---------------------------------------------------------------- */

  describe("Auditor Query 3: verify chain integrity for entire 30-day period", () => {
    it("validates all 500 entries pass chain integrity check", async () => {
      const res = await app.request(`/chains/${CHAIN_ID}/validate`, {
        method: "POST",
        headers: authHeader(),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        valid: boolean;
        chainId: string;
        entryCount: number;
      };

      expect(body.valid).toBe(true);
      expect(body.chainId).toBe(CHAIN_ID);
      expect(body.entryCount).toBe(500);
    });

    it("validates individual entry hash integrity for spot-check entries", async () => {
      // Spot-check 10 entries at various positions
      const spotCheckIndices = [0, 49, 100, 199, 250, 300, 399, 450, 480, 499];
      for (const idx of spotCheckIndices) {
        const entryId = scenario.entries[idx].entryId;
        const res = await app.request(
          `/chains/${CHAIN_ID}/entries/${entryId}/validate`,
          { method: "POST", headers: authHeader() },
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { valid: boolean; entryId: string };
        expect(body.valid).toBe(true);
        expect(body.entryId).toBe(entryId);
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Query 4: Colorado AI Act compliance report                       */
  /* ---------------------------------------------------------------- */

  describe("Auditor Query 4: Colorado AI Act compliance report", () => {
    it("generates a report with all required sections per SB 205", async () => {
      const res = await app.request(
        `/reports/colorado-sb205?chainId=${CHAIN_ID}`,
        { headers: authHeader() },
      );
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        report: {
          reportId: string;
          generatedAt: string;
          chainId: string;
          chainIntegrity: {
            valid: boolean;
            totalEntries: number;
          };
          regulationSummaries: Array<{
            regulationId: string;
            regulationName: string;
            totalRequirements: number;
            applicableRequirements: number;
            satisfiedRequirements: number;
            complianceRate: number;
          }>;
          gaps: Array<{
            entryId: string;
            requirementId: string;
            regulationId: string;
            requirementTitle: string;
            missingFields: string[];
            gaps: string[];
          }>;
          certificateSummaries: Array<{
            certificateId: string;
            entryId: string;
          }>;
          statistics: {
            totalEntries: number;
            entriesWithCertificates: number;
            entriesWithProvenance: number;
            totalGaps: number;
            overallComplianceRate: number;
          };
        };
      };

      const report = body.report;

      // Chain integrity must pass
      expect(report.chainIntegrity.valid).toBe(true);
      expect(report.chainIntegrity.totalEntries).toBe(500);

      // Report must reference the correct chain
      expect(report.chainId).toBe(CHAIN_ID);

      // Must have a regulation summary for colorado-sb205
      expect(report.regulationSummaries).toHaveLength(1);
      const summary = report.regulationSummaries[0];
      expect(summary.regulationId).toBe("colorado-sb205");
      expect(summary.regulationName).toBe("Colorado AI Act (SB 24-205)");
      expect(summary.totalRequirements).toBe(6);
      expect(summary.complianceRate).toBeGreaterThanOrEqual(0);
      expect(summary.complianceRate).toBeLessThanOrEqual(1);

      // Statistics must accurately count entries
      expect(report.statistics.totalEntries).toBe(500);

      // Count entries with certificates in scenario
      const withCerts = scenario.entries.filter(
        (e) => e.reasoningCertificateId !== null,
      ).length;
      expect(report.statistics.entriesWithCertificates).toBe(withCerts);

      // Count entries with provenance in scenario
      const withProv = scenario.entries.filter(
        (e) => e.provenanceId !== null,
      ).length;
      expect(report.statistics.entriesWithProvenance).toBe(withProv);

      // Timestamp must be a valid ISO 8601 string
      expect(new Date(report.generatedAt).toISOString()).toBe(
        report.generatedAt,
      );

      // Report ID must be a valid UUID
      expect(report.reportId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("generates reports for all 4 registered regulations", async () => {
      const regRes = await app.request("/reports", { headers: authHeader() });
      const { regulations } = (await regRes.json()) as {
        regulations: string[];
      };

      expect(regulations).toContain("colorado-sb205");
      expect(regulations).toContain("nist-ai-rmf");
      expect(regulations).toContain("eu-ai-act");
      expect(regulations).toContain("hipaa-164-312-b");

      for (const reg of regulations) {
        const res = await app.request(
          `/reports/${reg}?chainId=${CHAIN_ID}`,
          { headers: authHeader() },
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
          report: {
            chainIntegrity: { valid: boolean };
            statistics: { totalEntries: number };
            regulationSummaries: Array<{ regulationId: string }>;
          };
        };
        expect(body.report.chainIntegrity.valid).toBe(true);
        expect(body.report.statistics.totalEntries).toBe(500);
        expect(body.report.regulationSummaries[0].regulationId).toBe(reg);
      }
    });

    it("returns 404 for unknown regulation", async () => {
      const res = await app.request(
        `/reports/fake-regulation?chainId=${CHAIN_ID}`,
        { headers: authHeader() },
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as {
        error: string;
        available: string[];
      };
      expect(body.error).toContain("fake-regulation");
      expect(body.available.length).toBe(4);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Query 5: Escalated authority level entries                       */
  /* ---------------------------------------------------------------- */

  describe("Auditor Query 5: entries where authority_level was escalated", () => {
    it("identifies all escalated entries via tags and verifies escalation_trigger", async () => {
      // Fetch all entries (paginated)
      const allEntries: Array<{
        entryId: string;
        tags: Record<string, string>;
        annotation: string | null;
        entryType: string;
      }> = [];

      let offset = 0;
      const limit = 100;
      while (true) {
        const res = await app.request(
          `/chains/${CHAIN_ID}/entries?offset=${offset}&limit=${limit}`,
          { headers: authHeader() },
        );
        const body = (await res.json()) as {
          entries: typeof allEntries;
          total: number;
        };
        allEntries.push(...body.entries);
        if (allEntries.length >= body.total) break;
        offset += limit;
      }

      expect(allEntries).toHaveLength(500);

      // Find escalated entries (review_status === "escalated" in tags)
      const escalated = allEntries.filter(
        (e) => e.tags?.review_status === "escalated",
      );

      // Verify against scenario data
      const expectedEscalated = scenario.entries.filter(
        (e) => e.tags.review_status === "escalated",
      );
      expect(escalated).toHaveLength(expectedEscalated.length);
      expect(escalated.length).toBeGreaterThan(0);

      // Every escalated entry must have an escalation_trigger tag
      for (const entry of escalated) {
        expect(entry.tags.escalation_trigger).toBeDefined();
        expect(entry.tags.escalation_trigger.length).toBeGreaterThan(0);
      }

      // Escalated entries should be human_override type
      for (const entry of escalated) {
        expect(entry.entryType).toBe("human_override");
      }

      // Escalated entries should have annotation
      for (const entry of escalated) {
        expect(entry.annotation).not.toBeNull();
        expect(entry.annotation).toContain("Escalated");
      }
    });

    it("verifies review status distribution roughly matches expected ratios", async () => {
      // Fetch all entries
      const res = await app.request(
        `/chains/${CHAIN_ID}/entries?limit=500`,
        { headers: authHeader() },
      );
      const body = (await res.json()) as {
        entries: Array<{ tags: Record<string, string> }>;
      };

      const statusCounts: Record<string, number> = {
        approved: 0,
        pending: 0,
        rejected: 0,
        escalated: 0,
      };

      for (const entry of body.entries) {
        const status = entry.tags?.review_status;
        if (status && status in statusCounts) {
          statusCounts[status]++;
        }
      }

      // With 500 entries and seeded random, check approximate distribution
      // 60% approved, 20% pending, 10% rejected, 10% escalated
      // Allow reasonable variance for PRNG
      expect(statusCounts.approved).toBeGreaterThan(200);
      expect(statusCounts.pending).toBeGreaterThan(50);
      expect(statusCounts.rejected).toBeGreaterThan(20);
      expect(statusCounts.escalated).toBeGreaterThan(20);

      const total =
        statusCounts.approved +
        statusCounts.pending +
        statusCounts.rejected +
        statusCounts.escalated;
      expect(total).toBe(500);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Query 6: Unsupported claims in reasoning certificates            */
  /* ---------------------------------------------------------------- */

  describe("Auditor Query 6: entries with unsupported_claims in reasoning certificate", () => {
    it("identifies certificates with unsupported claims and verifies content", async () => {
      // Certificates with unsupported claims (every 5th cert)
      const certsWithUnsupported = scenario.certificates.filter(
        (c) => c.unsupportedClaims.length > 0,
      );
      expect(certsWithUnsupported.length).toBe(10);

      for (const cert of certsWithUnsupported) {
        const res = await app.request(
          `/certificates/${cert.certificateId}`,
          { headers: authHeader() },
        );
        expect(res.status).toBe(200);

        const body = (await res.json()) as {
          certificate: {
            certificateId: string;
            unsupportedClaims: Array<{
              statement: string;
              reason: string;
            }>;
          };
        };

        expect(body.certificate.certificateId).toBe(cert.certificateId);
        expect(body.certificate.unsupportedClaims.length).toBeGreaterThan(0);

        // Verify round-trip of unsupported claim data
        for (let i = 0; i < cert.unsupportedClaims.length; i++) {
          expect(body.certificate.unsupportedClaims[i].statement).toBe(
            cert.unsupportedClaims[i].statement,
          );
          expect(body.certificate.unsupportedClaims[i].reason).toBe(
            cert.unsupportedClaims[i].reason,
          );
        }
      }
    });

    it("verifies certificate hash integrity for certificates with unsupported claims", async () => {
      const certsWithUnsupported = scenario.certificates.filter(
        (c) => c.unsupportedClaims.length > 0,
      );

      for (const cert of certsWithUnsupported) {
        const res = await app.request(
          `/certificates/${cert.certificateId}/verify`,
          { method: "POST", headers: authHeader() },
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { valid: boolean };
        expect(body.valid).toBe(true);
      }
    });

    it("links entries to certificates with unsupported claims", async () => {
      // For each cert with unsupported claims, find the entry that references it
      const certIdsWithUnsupported = new Set(
        scenario.certificates
          .filter((c) => c.unsupportedClaims.length > 0)
          .map((c) => c.certificateId),
      );

      const entriesWithUnsupportedCerts = scenario.entries.filter(
        (e) =>
          e.reasoningCertificateId !== null &&
          certIdsWithUnsupported.has(e.reasoningCertificateId),
      );

      expect(entriesWithUnsupportedCerts.length).toBeGreaterThan(0);

      // Verify each entry exists in the chain and references the correct cert
      for (const entry of entriesWithUnsupportedCerts) {
        const res = await app.request(
          `/chains/${CHAIN_ID}/entries/${entry.entryId}`,
          { headers: authHeader() },
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
          entry: { reasoningCertificateId: string };
        };
        expect(body.entry.reasoningCertificateId).toBe(
          entry.reasoningCertificateId,
        );
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Query 7: AIBOM verification for model provenance                 */
  /* ---------------------------------------------------------------- */

  describe("Auditor Query 7: verify AIBOM for each model", () => {
    it("retrieves and verifies provenance records for all 5 models", async () => {
      for (let mi = 0; mi < MODELS.length; mi++) {
        const model = MODELS[mi];
        const provId = scenario.provenances[mi].provenanceId;
        const res = await app.request(`/provenance/${provId}`, {
          headers: authHeader(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as {
          provenance: {
            provenanceId: string;
            bomVersion: string;
            modelName: string;
            modelVersion: string;
            modelType: string;
            modelProvider: string;
            provenanceHash: string;
            trainingDatasets: Array<{ datasetId: string; name: string }>;
            performanceMetrics: Array<{
              name: string;
              value: number;
            }>;
            ethicalConsiderations: Array<{ category: string }>;
            externalReferences: Array<{
              referenceType: string;
              url: string;
            }>;
          };
        };

        const prov = body.provenance;

        // Core AIBOM fields present
        expect(prov.provenanceId).toBe(provId);
        expect(prov.bomVersion).toBe("1.7");
        expect(prov.modelName).toBe(model.id);
        expect(prov.modelProvider).toBe(model.provider);
        expect(prov.modelType).toBe("generative");

        // Hash is a valid SHA-256 hex string
        expect(prov.provenanceHash).toMatch(/^[0-9a-f]{64}$/);

        // Training datasets present
        expect(prov.trainingDatasets.length).toBeGreaterThan(0);
        expect(prov.trainingDatasets[0].name).toBe("WebCorpus");

        // Performance metrics present
        expect(prov.performanceMetrics.length).toBeGreaterThan(0);
        expect(prov.performanceMetrics[0].name).toBe("accuracy");
        expect(prov.performanceMetrics[0].value).toBeGreaterThanOrEqual(0);
        expect(prov.performanceMetrics[0].value).toBeLessThanOrEqual(1);

        // Ethical considerations present
        expect(prov.ethicalConsiderations.length).toBeGreaterThan(0);

        // External references present
        expect(prov.externalReferences.length).toBeGreaterThan(0);
      }
    });

    it("verifies provenance hash integrity for all models", async () => {
      for (const prov of scenario.provenances) {
        const provId = prov.provenanceId;
        const res = await app.request(`/provenance/${provId}/verify`, {
          method: "POST",
          headers: authHeader(),
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { valid: boolean };
        expect(body.valid).toBe(true);
      }
    });

    it("confirms entries reference valid provenance records", async () => {
      // Entries with provenanceId should reference real records
      const entriesWithProv = scenario.entries.filter(
        (e) => e.provenanceId !== null,
      );
      expect(entriesWithProv.length).toBe(100); // every 5th of 500

      // Spot-check 10 entries
      for (let i = 0; i < 10; i++) {
        const entry = entriesWithProv[i * 10];
        const entryRes = await app.request(
          `/chains/${CHAIN_ID}/entries/${entry.entryId}`,
          { headers: authHeader() },
        );
        expect(entryRes.status).toBe(200);
        const entryBody = (await entryRes.json()) as {
          entry: { provenanceId: string };
        };

        // The referenced provenance must exist and be valid
        const provRes = await app.request(
          `/provenance/${entryBody.entry.provenanceId}`,
          { headers: authHeader() },
        );
        expect(provRes.status).toBe(200);
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Cross-cutting: Pagination correctness                            */
  /* ---------------------------------------------------------------- */

  describe("Cross-cutting: pagination over full dataset", () => {
    it("paginates through all 500 entries with no duplicates or gaps", async () => {
      const seenIds = new Set<string>();
      let offset = 0;
      const limit = 75; // Intentionally not a divisor of 500

      while (offset < 500) {
        const res = await app.request(
          `/chains/${CHAIN_ID}/entries?offset=${offset}&limit=${limit}`,
          { headers: authHeader() },
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
          entries: Array<{ entryId: string }>;
          total: number;
        };

        expect(body.total).toBe(500);

        for (const entry of body.entries) {
          expect(seenIds.has(entry.entryId)).toBe(false);
          seenIds.add(entry.entryId);
        }

        if (body.entries.length < limit) break;
        offset += limit;
      }

      expect(seenIds.size).toBe(500);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Cross-cutting: Tool-call entries                                 */
  /* ---------------------------------------------------------------- */

  describe("Cross-cutting: tool_call entries", () => {
    it("contains tool_call entries from both rotation (0-399) and forced range (400-499)", async () => {
      const res = await app.request(
        `/chains/${CHAIN_ID}/entries?offset=0&limit=500`,
        { headers: authHeader() },
      );
      const body = (await res.json()) as {
        entries: Array<{
          entryId: string;
          decisionType: string | null;
          sequenceNumber: number;
        }>;
      };

      const toolCallEntries = body.entries.filter(
        (e) => e.decisionType === "tool_call",
      );

      // Expected: entries 400-499 are all tool_call (100),
      // plus entries in 0-399 where i % 8 === 6 (tool_call index in DECISION_TYPES)
      const expectedCount = scenario.entries.filter(
        (e) => e.decisionType === "tool_call",
      ).length;
      expect(toolCallEntries.length).toBe(expectedCount);
      expect(toolCallEntries.length).toBeGreaterThanOrEqual(100);

      // All entries 400-499 must be tool_call
      const highRange = body.entries.filter(
        (e) => e.sequenceNumber >= 400 && e.sequenceNumber <= 499,
      );
      for (const e of highRange) {
        expect(e.decisionType).toBe("tool_call");
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Cross-cutting: Actor filtering                                   */
  /* ---------------------------------------------------------------- */

  describe("Cross-cutting: actor-based filtering", () => {
    it("filters by actorId and counts match scenario data", async () => {
      for (const actorId of ["actor-1", "actor-2", "actor-3"]) {
        const res = await app.request(
          `/chains/${CHAIN_ID}/entries?actorId=${actorId}&limit=500`,
          { headers: authHeader() },
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { total: number };
        const expected = scenario.entries.filter(
          (e) => e.actorId === actorId,
        ).length;
        expect(body.total).toBe(expected);
      }
    });
  });
});
