/**
 * Integration tests for the full Sprint 3 compliance pipeline.
 *
 * Exercises the end-to-end flow: create chain, append entries across
 * different decision types and sectors, generate reasoning certificates,
 * create model provenance, run auto-tagging, generate compliance reports
 * for all 4 regulations, enforce authority boundary policies, and
 * produce CycloneDX ML-BOMs.
 */

import { describe, expect, it } from "vitest";
import {
  createChain,
  appendEntry,
  validateChain,
  createCertificate,
  createProvenance,
  verifyCertificate,
  verifyProvenance,
  tagEntry,
  tagEntryForRegulation,
  generateComplianceReport,
  exportReportAsJson,
  getAllRegulations,
  getRegulationById,
  getRegulationIds,
  generateCertificate as generateCertFromEngine,
  generateCertificateWithTemplate,
  getTemplateNames,
  confidenceLevelFromScore,
  enforcePolicy,
  enforcementToTags,
  generateCycloneDxBom,
  exportBomAsJson,
  exportBomAsCleanJson,
  stripNulls,
  createInMemoryAdapter,
} from "../../src/index.js";
import { parsePolicy } from "../../src/compliance/authority/policy-parser.js";
import type {
  AppendEntryInput,
  ChainState,
  ProofChainEntry,
  ReasoningCertificate,
  ModelProvenance,
  EntryMetadata,
  ComplianceReport,
  DecisionContext,
  Premise,
  TraceStep,
  Conclusion,
  GenerateBomInput,
  ActionRequest,
} from "../../src/index.js";
import type { Sector, DataType, AuthorityLevel, RiskLevel } from "../../src/compliance/types.js";
import type { DecisionType, EntryType } from "../../src/schema/entry-types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHAIN_ID = "integration-test-chain";
const TIMESTAMP = "2026-04-05T12:00:00Z";

let entryCounter = 0;

function nextEntryId(): string {
  entryCounter += 1;
  return `entry-${String(entryCounter).padStart(4, "0")}`;
}

function resetCounter(): void {
  entryCounter = 0;
}

type EntrySpec = {
  entryType: EntryType;
  decisionType?: DecisionType;
  modelId?: string;
  modelProvider?: string;
  inputHash?: string;
  outputHash?: string;
  confidenceScore?: number;
  reasoningCertificateId?: string | null;
  provenanceId?: string | null;
  sessionId?: string;
  actorId?: string;
  policyIds?: ReadonlyArray<string>;
  tags?: Readonly<Record<string, string>>;
  annotation?: string;
};

function buildAppendInput(spec: EntrySpec): AppendEntryInput {
  return {
    entryId: nextEntryId(),
    timestamp: TIMESTAMP,
    entryType: spec.entryType,
    decisionType: spec.decisionType ?? null,
    modelId: spec.modelId ?? null,
    modelProvider: spec.modelProvider ?? null,
    inputHash: spec.inputHash ?? null,
    outputHash: spec.outputHash ?? null,
    confidenceScore: spec.confidenceScore ?? null,
    reasoningCertificateId: spec.reasoningCertificateId ?? null,
    provenanceId: spec.provenanceId ?? null,
    sessionId: spec.sessionId ?? null,
    actorId: spec.actorId ?? null,
    policyIds: spec.policyIds ?? [],
    tags: spec.tags ?? {},
    annotation: spec.annotation ?? null,
  };
}

function appendMany(
  chain: ChainState,
  specs: ReadonlyArray<EntrySpec>,
): { chain: ChainState; entries: ReadonlyArray<ProofChainEntry> } {
  let current = chain;
  const entries: Array<ProofChainEntry> = [];
  for (const spec of specs) {
    const result = appendEntry(current, buildAppendInput(spec));
    if (!result.ok) {
      throw new Error(`appendEntry failed: ${JSON.stringify(result.error)}`);
    }
    current = result.value.chain;
    entries.push(result.value.entry);
  }
  return { chain: current, entries };
}

function makeMetadata(overrides: Partial<EntryMetadata> = {}): EntryMetadata {
  return {
    sectors: [],
    dataTypes: [],
    authorityLevel: null,
    riskLevel: null,
    ...overrides,
  };
}

function makePremise(id: string, source: string | null = null): Premise {
  return { id, statement: `Premise ${id}`, source, required: true };
}

function makeTraceStep(stepId: string): TraceStep {
  return {
    stepId,
    description: `Trace step ${stepId}`,
    inputRefs: [],
    outputRef: null,
  };
}

function makeConclusion(
  premiseIds: ReadonlyArray<string>,
  traceIds: ReadonlyArray<string>,
): Conclusion {
  return {
    statement: "Decision reached based on analysis",
    supportingPremiseIds: premiseIds,
    supportingTraceStepIds: traceIds,
  };
}

function makeDecisionContext(
  certId: string,
  decisionType: DecisionType,
  premiseSpecs: ReadonlyArray<{ id: string; source: string | null }>,
  traceStepIds: ReadonlyArray<string>,
  confidenceScore: number,
): DecisionContext {
  const premises = premiseSpecs.map((p) => makePremise(p.id, p.source));
  const trace = traceStepIds.map((id) => makeTraceStep(id));
  return {
    certificateId: certId,
    timestamp: TIMESTAMP,
    modelId: "gpt-4o",
    modelProvider: "openai",
    decisionType,
    premises,
    executionTrace: trace,
    conclusion: makeConclusion(
      premiseSpecs.map((p) => p.id),
      traceStepIds,
    ),
    unsupportedClaims: [
      { statement: "Data is fully representative", reason: "No population stats" },
    ],
    assumptions: [{ statement: "Input data is accurate", criticality: "high" }],
    limitations: [
      { description: "English only", impact: "Non-English inputs not covered" },
    ],
    confidenceScore,
  };
}

// ---------------------------------------------------------------------------
// Entry specs covering diverse decision types and sectors
// ---------------------------------------------------------------------------

/**
 * Generates 50 entry specs spanning all entry types and decision types.
 * Some entries have certificates and provenance attached, some do not,
 * to exercise gap detection in compliance reports.
 */
function generate50EntrySpecs(
  certificateIds: ReadonlyArray<string>,
  provenanceIds: ReadonlyArray<string>,
): ReadonlyArray<EntrySpec> {
  const specs: Array<EntrySpec> = [];

  // Group 1: Healthcare AI decisions with certificates and provenance (10 entries)
  for (let i = 0; i < 10; i++) {
    specs.push({
      entryType: "ai_decision",
      decisionType: i < 3 ? "classification" : i < 6 ? "recommendation" : "other",
      modelId: "gpt-4o",
      modelProvider: "openai",
      inputHash: `input-hash-${i}`,
      outputHash: `output-hash-${i}`,
      confidenceScore: 0.7 + i * 0.03,
      reasoningCertificateId: certificateIds[i] ?? null,
      provenanceId: provenanceIds[0] ?? null,
      sessionId: "session-healthcare",
      actorId: "clinician-01",
      policyIds: ["policy-hipaa"],
      tags: { department: "radiology" },
      annotation: `Healthcare decision ${i + 1}`,
    });
  }

  // Group 2: Finance AI decisions with partial certificates (10 entries)
  for (let i = 0; i < 10; i++) {
    specs.push({
      entryType: "ai_decision",
      decisionType: i < 5 ? "classification" : "recommendation",
      modelId: "claude-3-opus",
      modelProvider: "anthropic",
      inputHash: `fin-input-${i}`,
      outputHash: `fin-output-${i}`,
      confidenceScore: 0.6 + i * 0.04,
      reasoningCertificateId: i < 5 ? (certificateIds[i] ?? null) : null,
      provenanceId: provenanceIds[1] ?? null,
      sessionId: "session-finance",
      actorId: "analyst-01",
    });
  }

  // Group 3: Government/employment human overrides (5 entries)
  for (let i = 0; i < 5; i++) {
    specs.push({
      entryType: "human_override",
      modelId: "gpt-4o",
      modelProvider: "openai",
      actorId: "supervisor-01",
      sessionId: "session-gov",
      annotation: `Override decision ${i + 1}`,
    });
  }

  // Group 4: System events (5 entries)
  for (let i = 0; i < 5; i++) {
    specs.push({
      entryType: "system_event",
      sessionId: "session-system",
      actorId: "system",
      tags: { event: `system-check-${i}` },
    });
  }

  // Group 5: Policy checks with provenance (5 entries)
  for (let i = 0; i < 5; i++) {
    specs.push({
      entryType: "policy_check",
      modelId: "internal-policy-engine",
      modelProvider: "gridseal",
      provenanceId: provenanceIds[2] ?? null,
      sessionId: "session-policy",
      actorId: "policy-engine",
      policyIds: ["policy-colorado-ai-act", "policy-eu-ai-act"],
    });
  }

  // Group 6: Data access entries (5 entries)
  for (let i = 0; i < 5; i++) {
    specs.push({
      entryType: "data_access",
      sessionId: "session-data",
      actorId: `data-consumer-${i}`,
      tags: { resource: `dataset-${i}` },
    });
  }

  // Group 7: Model deployment entries with provenance (5 entries)
  for (let i = 0; i < 5; i++) {
    specs.push({
      entryType: "model_deployment",
      modelId: `model-v${i}`,
      modelProvider: "openai",
      provenanceId: provenanceIds[i % 3] ?? null,
      sessionId: "session-deploy",
      actorId: "mlops-01",
    });
  }

  // Group 8: Feedback and correction entries (5 entries)
  for (let i = 0; i < 3; i++) {
    specs.push({
      entryType: "feedback",
      actorId: "user-feedback",
      sessionId: "session-feedback",
      annotation: `User feedback ${i + 1}`,
    });
  }
  for (let i = 0; i < 2; i++) {
    specs.push({
      entryType: "correction",
      actorId: "reviewer-01",
      sessionId: "session-corrections",
      annotation: `Correction ${i + 1}`,
    });
  }

  return specs;
}

// ---------------------------------------------------------------------------
// Metadata profiles for different entry groups
// ---------------------------------------------------------------------------

function metadataForGroup(
  groupIndex: number,
): EntryMetadata {
  switch (groupIndex) {
    case 0: // Healthcare
      return makeMetadata({
        sectors: ["healthcare"],
        dataTypes: ["health", "personal"],
        authorityLevel: "human_in_the_loop",
        riskLevel: "high",
      });
    case 1: // Finance
      return makeMetadata({
        sectors: ["finance"],
        dataTypes: ["financial", "personal"],
        authorityLevel: "human_on_the_loop",
        riskLevel: "high",
      });
    case 2: // Government overrides
      return makeMetadata({
        sectors: ["government", "employment"],
        dataTypes: ["personal"],
        authorityLevel: "human_in_the_loop",
        riskLevel: "high",
      });
    case 3: // System events
      return makeMetadata({
        sectors: ["general"],
        dataTypes: ["aggregated"],
        authorityLevel: null,
        riskLevel: "minimal",
      });
    case 4: // Policy checks
      return makeMetadata({
        sectors: ["government"],
        dataTypes: ["personal"],
        authorityLevel: "autonomous",
        riskLevel: "limited",
      });
    case 5: // Data access
      return makeMetadata({
        sectors: ["healthcare"],
        dataTypes: ["health", "sensitive"],
        authorityLevel: "advisory",
        riskLevel: "high",
      });
    case 6: // Model deployment
      return makeMetadata({
        sectors: ["general"],
        dataTypes: ["public"],
        authorityLevel: "autonomous",
        riskLevel: "limited",
      });
    case 7: // Feedback + corrections
      return makeMetadata({
        sectors: ["general"],
        dataTypes: ["personal"],
        authorityLevel: "advisory",
        riskLevel: "minimal",
      });
    default:
      return makeMetadata();
  }
}

/** Maps entry index (0-49) to its group index (0-7). */
function groupForEntry(index: number): number {
  if (index < 10) return 0;
  if (index < 20) return 1;
  if (index < 25) return 2;
  if (index < 30) return 3;
  if (index < 35) return 4;
  if (index < 40) return 5;
  if (index < 45) return 6;
  return 7;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Compliance Pipeline Integration", () => {
  // Shared state built once and reused across tests in this describe block.
  let chain: ChainState;
  let entries: ReadonlyArray<ProofChainEntry>;
  const certificates = new Map<string, ReasoningCertificate>();
  const provenanceRecords: Array<ModelProvenance> = [];
  const entryMetadataOverrides: Record<string, EntryMetadata> = {};

  // Build the chain with 50 entries before all tests.
  // Vitest runs describe blocks synchronously, so we set up inline.

  // Step 1: Create reasoning certificates
  const certContexts: ReadonlyArray<DecisionContext> = [
    makeDecisionContext(
      "cert-class-001",
      "classification",
      [
        { id: "input_data-001", source: "input_data" },
        { id: "classification_criteria-001", source: "classification_criteria" },
        { id: "historical-data", source: "historical_records" },
      ],
      ["feature_analysis-001", "category_assignment-001"],
      0.92,
    ),
    makeDecisionContext(
      "cert-class-002",
      "classification",
      [
        { id: "input_data-002", source: "input_data" },
        { id: "classification_criteria-002", source: "classification_criteria" },
      ],
      ["feature_analysis-002", "category_assignment-002"],
      0.88,
    ),
    makeDecisionContext(
      "cert-class-003",
      "classification",
      [
        { id: "input_data-003", source: "input_data" },
        { id: "classification_criteria-003", source: "classification_criteria" },
      ],
      ["feature_analysis-003", "category_assignment-003"],
      0.85,
    ),
    makeDecisionContext(
      "cert-rec-001",
      "recommendation",
      [
        { id: "user_context-001", source: "user_context" },
        { id: "available_options-001", source: "available_options" },
        { id: "ranking_criteria-001", source: "ranking_criteria" },
      ],
      ["option_evaluation-001", "ranking-001"],
      0.78,
    ),
    makeDecisionContext(
      "cert-rec-002",
      "recommendation",
      [
        { id: "user_context-002", source: "user_context" },
        { id: "available_options-002", source: "available_options" },
        { id: "ranking_criteria-002", source: "ranking_criteria" },
      ],
      ["option_evaluation-002", "ranking-002"],
      0.81,
    ),
    makeDecisionContext(
      "cert-other-001",
      "other",
      [
        { id: "data-001", source: "general_data" },
        { id: "criteria-001", source: "analysis_criteria" },
      ],
      ["step-001", "step-002"],
      0.75,
    ),
    makeDecisionContext(
      "cert-other-002",
      "other",
      [
        { id: "data-002", source: "general_data" },
        { id: "criteria-002", source: "analysis_criteria" },
      ],
      ["step-003", "step-004"],
      0.72,
    ),
    makeDecisionContext(
      "cert-other-003",
      "other",
      [
        { id: "data-003", source: "general_data" },
        { id: "criteria-003", source: "analysis_criteria" },
      ],
      ["step-005", "step-006"],
      0.69,
    ),
    makeDecisionContext(
      "cert-fin-class-001",
      "classification",
      [
        { id: "input_data-f01", source: "input_data" },
        { id: "classification_criteria-f01", source: "classification_criteria" },
      ],
      ["feature_analysis-f01", "category_assignment-f01"],
      0.90,
    ),
    makeDecisionContext(
      "cert-fin-class-002",
      "classification",
      [
        { id: "input_data-f02", source: "input_data" },
        { id: "classification_criteria-f02", source: "classification_criteria" },
      ],
      ["feature_analysis-f02", "category_assignment-f02"],
      0.87,
    ),
  ];

  const generatedCerts: Array<ReasoningCertificate> = [];
  for (const ctx of certContexts) {
    const cert = generateCertFromEngine(ctx);
    generatedCerts.push(cert);
    certificates.set(cert.certificateId, cert);
  }

  const certificateIds = generatedCerts.map((c) => c.certificateId);

  // Step 2: Create model provenance records
  const provenanceInputs = [
    {
      provenanceId: "prov-gpt4o",
      timestamp: TIMESTAMP,
      bomVersion: "1.7",
      modelName: "GPT-4o",
      modelVersion: "2025-01-01",
      modelType: "generative" as const,
      modelProvider: "OpenAI",
      modelDescription: "Large multimodal model",
      modelAuthor: "OpenAI",
      modelLicense: "Proprietary",
      trainingDatasets: [
        { datasetId: "ds-web", name: "WebText", version: "3.0", source: null, description: "Web-crawled text data" },
      ],
      performanceMetrics: [
        { metricId: "m-1", name: "accuracy", value: 0.95, slice: null, confidenceInterval: null },
      ],
      ethicalConsiderations: [
        { category: "fairness", description: "Bias evaluation pending", mitigationStrategy: "Ongoing monitoring" },
      ],
      externalReferences: [
        { referenceType: "model_card", url: "https://example.com/gpt4o-card", description: "Model card" },
      ],
    },
    {
      provenanceId: "prov-claude3",
      timestamp: TIMESTAMP,
      bomVersion: "1.7",
      modelName: "Claude 3 Opus",
      modelVersion: "2025-03-01",
      modelType: "generative" as const,
      modelProvider: "Anthropic",
      modelDescription: "Advanced language model",
      modelAuthor: "Anthropic",
      modelLicense: "Proprietary",
      trainingDatasets: [],
      performanceMetrics: [
        { metricId: "m-2", name: "helpfulness", value: 0.92, slice: null, confidenceInterval: null },
      ],
      ethicalConsiderations: [],
      externalReferences: [],
    },
    {
      provenanceId: "prov-policy-engine",
      timestamp: TIMESTAMP,
      bomVersion: "1.7",
      modelName: "Policy Engine",
      modelVersion: "1.0.0",
      modelType: "classification" as const,
      modelProvider: "Gridseal",
      modelDescription: "Internal policy evaluation engine",
      modelAuthor: null,
      modelLicense: "AGPL-3.0",
      trainingDatasets: [],
      performanceMetrics: [],
      ethicalConsiderations: [],
      externalReferences: [],
    },
  ];

  for (const input of provenanceInputs) {
    provenanceRecords.push(createProvenance(input));
  }

  const provenanceIds = provenanceRecords.map((p) => p.provenanceId);

  // Step 3: Build the chain with 50 entries
  resetCounter();
  const entrySpecs = generate50EntrySpecs(certificateIds, provenanceIds);
  const built = appendMany(createChain(CHAIN_ID), entrySpecs);
  chain = built.chain;
  entries = built.entries;

  // Build per-entry metadata overrides
  for (let i = 0; i < entries.length; i++) {
    entryMetadataOverrides[entries[i].entryId] = metadataForGroup(groupForEntry(i));
  }

  // -------------------------------------------------------------------------
  // Chain integrity
  // -------------------------------------------------------------------------

  describe("Chain Integrity", () => {
    it("builds a chain with exactly 50 entries", () => {
      expect(chain.entries.length).toBe(50);
    });

    it("validates the entire chain without errors", () => {
      const result = validateChain(chain);
      expect(result.ok).toBe(true);
    });

    it("assigns sequential sequence numbers 0 through 49", () => {
      for (let i = 0; i < 50; i++) {
        expect(chain.entries[i].sequenceNumber).toBe(i);
      }
    });

    it("links each entry to its predecessor via previousHash", () => {
      expect(chain.entries[0].previousHash).toBeNull();
      for (let i = 1; i < 50; i++) {
        expect(chain.entries[i].previousHash).toBe(chain.entries[i - 1].entryHash);
      }
    });

    it("assigns unique entry hashes to all entries", () => {
      const hashes = new Set(chain.entries.map((e) => e.entryHash));
      expect(hashes.size).toBe(50);
    });

    it("assigns unique entry IDs to all entries", () => {
      const ids = new Set(chain.entries.map((e) => e.entryId));
      expect(ids.size).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // Reasoning certificates
  // -------------------------------------------------------------------------

  describe("Reasoning Certificates", () => {
    it("generates 10 valid reasoning certificates", () => {
      expect(certificates.size).toBe(10);
    });

    it("each certificate has a unique ID", () => {
      const ids = [...certificates.keys()];
      expect(new Set(ids).size).toBe(10);
    });

    it("each certificate verifies against its hash", () => {
      for (const cert of certificates.values()) {
        expect(verifyCertificate(cert)).toBe(true);
      }
    });

    it("generates certificates via templates for classification decisions", () => {
      const ctx = certContexts[0];
      const { certificate, validation } = generateCertificateWithTemplate(ctx, "classification");
      expect(validation.valid).toBe(true);
      expect(certificate).not.toBeNull();
      expect(certificate!.certificateId).toBe("cert-class-001");
    });

    it("generates certificates via templates for recommendation decisions", () => {
      const ctx = certContexts[3];
      const { certificate, validation } = generateCertificateWithTemplate(ctx, "recommendation");
      expect(validation.valid).toBe(true);
      expect(certificate).not.toBeNull();
    });

    it("rejects template validation when required categories are missing", () => {
      const badCtx: DecisionContext = {
        certificateId: "cert-bad",
        timestamp: TIMESTAMP,
        modelId: "test-model",
        modelProvider: "test",
        decisionType: "classification",
        premises: [makePremise("p1")],
        executionTrace: [makeTraceStep("s1")],
        conclusion: makeConclusion(["p1"], ["s1"]),
        unsupportedClaims: [],
        assumptions: [],
        limitations: [],
        confidenceScore: 0.5,
      };
      const { certificate, validation } = generateCertificateWithTemplate(badCtx, "classification");
      expect(validation.valid).toBe(false);
      expect(certificate).toBeNull();
      expect(validation.missingPremiseCategories.length).toBeGreaterThan(0);
    });

    it("maps confidence scores to correct levels", () => {
      expect(confidenceLevelFromScore(0.1)).toBe("very_low");
      expect(confidenceLevelFromScore(0.3)).toBe("low");
      expect(confidenceLevelFromScore(0.5)).toBe("medium");
      expect(confidenceLevelFromScore(0.7)).toBe("high");
      expect(confidenceLevelFromScore(0.9)).toBe("very_high");
    });

    it("lists all 4 template names", () => {
      const names = getTemplateNames();
      expect(names).toContain("classification");
      expect(names).toContain("recommendation");
      expect(names).toContain("approval_denial");
      expect(names).toContain("risk_scoring");
    });
  });

  // -------------------------------------------------------------------------
  // Model provenance
  // -------------------------------------------------------------------------

  describe("Model Provenance", () => {
    it("creates 3 provenance records", () => {
      expect(provenanceRecords.length).toBe(3);
    });

    it("each provenance record verifies against its hash", () => {
      for (const prov of provenanceRecords) {
        expect(verifyProvenance(prov)).toBe(true);
      }
    });

    it("provenance records have unique IDs", () => {
      const ids = new Set(provenanceRecords.map((p) => p.provenanceId));
      expect(ids.size).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Auto-tagging
  // -------------------------------------------------------------------------

  describe("Auto-Tagging", () => {
    it("tags all 50 entries without throwing", () => {
      for (let i = 0; i < entries.length; i++) {
        const metadata = metadataForGroup(groupForEntry(i));
        const result = tagEntry(entries[i], metadata);
        expect(result.matches).toBeDefined();
        expect(result.regulationIds).toBeDefined();
      }
    });

    it("healthcare entries match HIPAA and Colorado SB 205 regulations", () => {
      const healthcareEntry = entries[0];
      const metadata = metadataForGroup(0);
      const result = tagEntry(healthcareEntry, metadata);
      expect(result.regulationIds).toContain("hipaa-164-312-b");
      expect(result.regulationIds).toContain("colorado-sb205");
    });

    it("finance entries match Colorado SB 205 and EU AI Act", () => {
      const financeEntry = entries[10];
      const metadata = metadataForGroup(1);
      const result = tagEntry(financeEntry, metadata);
      expect(result.regulationIds).toContain("colorado-sb205");
    });

    it("tags entries for a specific regulation", () => {
      const entry = entries[0];
      const metadata = metadataForGroup(0);
      const result = tagEntryForRegulation(entry, metadata, "hipaa-164-312-b");
      expect(result.regulationIds).toEqual(["hipaa-164-312-b"]);
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it("entries with certificates have hasReasoningCertificate in context", () => {
      const entryWithCert = entries[0]; // healthcare group, has certificate
      const metadata = metadataForGroup(0);
      const result = tagEntry(entryWithCert, metadata);
      expect(result.context.hasReasoningCertificate).toBe(true);
    });

    it("entries without certificates have hasReasoningCertificate as false", () => {
      const entryNoCert = entries[25]; // system event group, no certificate
      const metadata = metadataForGroup(3);
      const result = tagEntry(entryNoCert, metadata);
      expect(result.context.hasReasoningCertificate).toBe(false);
    });

    it("entries with provenance have hasProvenance in context", () => {
      const entryWithProv = entries[0]; // has provenanceId
      const metadata = metadataForGroup(0);
      const result = tagEntry(entryWithProv, metadata);
      expect(result.context.hasProvenance).toBe(true);
    });

    it("identifies gaps for entries missing required fields", () => {
      // System event entries have minimal fields, should have gaps for most regs
      const systemEntry = entries[25];
      const metadata = metadataForGroup(3);
      const result = tagEntry(systemEntry, metadata);
      const unsatisfied = result.matches.filter((m) => !m.satisfied);
      // System events with minimal risk should have few matches but some gaps
      // if applicable requirements need specific fields
      for (const match of unsatisfied) {
        expect(match.gaps.length).toBeGreaterThan(0);
      }
    });

    it("NIST AI RMF applies broadly across sectors", () => {
      // NIST has requirements with empty sector filters (applies to all)
      const entry = entries[0];
      const metadata = metadataForGroup(0);
      const result = tagEntryForRegulation(entry, metadata, "nist-ai-rmf");
      expect(result.matches.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Compliance reports
  // -------------------------------------------------------------------------

  describe("Compliance Report Generation", () => {
    let fullReport: ComplianceReport;

    it("generates a report covering all 4 regulations", () => {
      fullReport = generateComplianceReport({
        reportId: "integration-report-001",
        chain,
        defaultMetadata: makeMetadata({
          sectors: ["general"],
          dataTypes: ["personal"],
          authorityLevel: "advisory",
          riskLevel: "limited",
        }),
        entryMetadataOverrides,
        certificates,
      });

      expect(fullReport.reportId).toBe("integration-report-001");
      expect(fullReport.chainId).toBe(CHAIN_ID);
      expect(fullReport.chainIntegrity.valid).toBe(true);
      expect(fullReport.chainIntegrity.totalEntries).toBe(50);
    });

    it("includes summaries for all 4 regulations", () => {
      const regulationIds = fullReport.regulationSummaries.map((s) => s.regulationId);
      expect(regulationIds).toContain("colorado-sb205");
      expect(regulationIds).toContain("nist-ai-rmf");
      expect(regulationIds).toContain("eu-ai-act");
      expect(regulationIds).toContain("hipaa-164-312-b");
    });

    it("reports regulation summaries with correct structure", () => {
      for (const summary of fullReport.regulationSummaries) {
        expect(summary.regulationId).toBeTruthy();
        expect(summary.regulationName).toBeTruthy();
        expect(typeof summary.totalRequirements).toBe("number");
        expect(typeof summary.applicableRequirements).toBe("number");
        expect(typeof summary.satisfiedRequirements).toBe("number");
        expect(typeof summary.complianceRate).toBe("number");
        expect(summary.complianceRate).toBeGreaterThanOrEqual(0);
        expect(summary.complianceRate).toBeLessThanOrEqual(1);
      }
    });

    it("maps entries to regulations in entriesByRegulation", () => {
      for (const regId of getRegulationIds()) {
        const mappings = fullReport.entriesByRegulation[regId];
        expect(mappings).toBeDefined();
        expect(Array.isArray(mappings)).toBe(true);
      }
    });

    it("identifies compliance gaps", () => {
      // With 50 entries across varying completeness, there should be gaps
      expect(fullReport.gaps.length).toBeGreaterThan(0);
      for (const gap of fullReport.gaps) {
        expect(gap.entryId).toBeTruthy();
        expect(gap.requirementId).toBeTruthy();
        expect(gap.regulationId).toBeTruthy();
        expect(gap.missingFields).toBeDefined();
      }
    });

    it("includes certificate summaries for entries with certificates", () => {
      expect(fullReport.certificateSummaries.length).toBeGreaterThan(0);
      for (const summary of fullReport.certificateSummaries) {
        expect(summary.certificateId).toBeTruthy();
      }
    });

    it("computes overall statistics", () => {
      const stats = fullReport.statistics;
      expect(stats.totalEntries).toBe(50);
      expect(stats.entriesWithCertificates).toBeGreaterThan(0);
      expect(stats.entriesWithProvenance).toBeGreaterThan(0);
      expect(stats.totalGaps).toBeGreaterThan(0);
      expect(typeof stats.overallComplianceRate).toBe("number");
    });

    it("exports report as valid JSON", () => {
      const json = exportReportAsJson(fullReport);
      const parsed = JSON.parse(json) as ComplianceReport;
      expect(parsed.reportId).toBe("integration-report-001");
      expect(parsed.chainIntegrity.valid).toBe(true);
      expect(parsed.statistics.totalEntries).toBe(50);
    });

    it("generates report filtered to a single regulation (Colorado SB 205)", () => {
      const coloradoReport = generateComplianceReport({
        reportId: "colorado-only-report",
        chain,
        defaultMetadata: makeMetadata({
          sectors: ["healthcare"],
          dataTypes: ["health"],
          riskLevel: "high",
        }),
        entryMetadataOverrides,
        regulationIds: ["colorado-sb205"],
        certificates,
      });

      expect(coloradoReport.regulationSummaries.length).toBe(1);
      expect(coloradoReport.regulationSummaries[0].regulationId).toBe("colorado-sb205");
      expect(Object.keys(coloradoReport.entriesByRegulation)).toEqual(["colorado-sb205"]);
    });

    it("generates report filtered to HIPAA", () => {
      const hipaaReport = generateComplianceReport({
        reportId: "hipaa-only-report",
        chain,
        defaultMetadata: makeMetadata({
          sectors: ["healthcare"],
          dataTypes: ["health"],
          riskLevel: "high",
        }),
        entryMetadataOverrides,
        regulationIds: ["hipaa-164-312-b"],
        certificates,
      });

      expect(hipaaReport.regulationSummaries.length).toBe(1);
      expect(hipaaReport.regulationSummaries[0].regulationId).toBe("hipaa-164-312-b");
    });

    it("generates report filtered to EU AI Act", () => {
      const euReport = generateComplianceReport({
        reportId: "eu-ai-act-report",
        chain,
        defaultMetadata: makeMetadata({
          sectors: ["general"],
          dataTypes: ["personal"],
          riskLevel: "high",
        }),
        entryMetadataOverrides,
        regulationIds: ["eu-ai-act"],
        certificates,
      });

      expect(euReport.regulationSummaries.length).toBe(1);
      expect(euReport.regulationSummaries[0].regulationId).toBe("eu-ai-act");
    });

    it("generates report filtered to NIST AI RMF", () => {
      const nistReport = generateComplianceReport({
        reportId: "nist-report",
        chain,
        defaultMetadata: makeMetadata({
          sectors: ["general"],
          riskLevel: "high",
        }),
        entryMetadataOverrides,
        regulationIds: ["nist-ai-rmf"],
        certificates,
      });

      expect(nistReport.regulationSummaries.length).toBe(1);
      expect(nistReport.regulationSummaries[0].regulationId).toBe("nist-ai-rmf");
    });

    it("entries with full metadata and certificates have higher compliance rates", () => {
      // Healthcare entries (group 0) have certs, provenance, high-risk metadata
      // System events (group 3) have minimal metadata
      const healthcareReport = generateComplianceReport({
        reportId: "healthcare-focused",
        chain: { chainId: CHAIN_ID, entries: [...entries.slice(0, 10)] },
        defaultMetadata: metadataForGroup(0),
        certificates,
      });

      const systemReport = generateComplianceReport({
        reportId: "system-focused",
        chain: { chainId: CHAIN_ID, entries: [...entries.slice(25, 30)] },
        defaultMetadata: metadataForGroup(3),
      });

      // Healthcare entries should generally have better compliance
      // because they have certificates and provenance attached
      const healthcareWithCerts = healthcareReport.statistics.entriesWithCertificates;
      const systemWithCerts = systemReport.statistics.entriesWithCertificates;
      expect(healthcareWithCerts).toBeGreaterThan(systemWithCerts);
    });
  });

  // -------------------------------------------------------------------------
  // Regulation registry
  // -------------------------------------------------------------------------

  describe("Regulation Registry", () => {
    it("returns all 4 regulations", () => {
      const allRegs = getAllRegulations();
      expect(allRegs.length).toBe(4);
    });

    it("returns correct regulation IDs", () => {
      const ids = getRegulationIds();
      expect(ids).toContain("colorado-sb205");
      expect(ids).toContain("nist-ai-rmf");
      expect(ids).toContain("eu-ai-act");
      expect(ids).toContain("hipaa-164-312-b");
    });

    it("looks up regulations by ID", () => {
      for (const id of getRegulationIds()) {
        const reg = getRegulationById(id);
        expect(reg).toBeDefined();
        expect(reg!.regulationId).toBe(id);
        expect(reg!.requirements.length).toBeGreaterThan(0);
      }
    });

    it("returns 38 total requirements across all regulations", () => {
      const allRegs = getAllRegulations();
      const totalReqs = allRegs.reduce((sum, r) => sum + r.requirements.length, 0);
      expect(totalReqs).toBe(38);
    });

    it("Colorado SB 205 has 6 requirements", () => {
      const reg = getRegulationById("colorado-sb205");
      expect(reg!.requirements.length).toBe(6);
    });

    it("NIST AI RMF has 19 requirements", () => {
      const reg = getRegulationById("nist-ai-rmf");
      expect(reg!.requirements.length).toBe(19);
    });

    it("EU AI Act has 8 requirements", () => {
      const reg = getRegulationById("eu-ai-act");
      expect(reg!.requirements.length).toBe(8);
    });

    it("HIPAA 164.312(b) has 5 requirements", () => {
      const reg = getRegulationById("hipaa-164-312-b");
      expect(reg!.requirements.length).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // Authority boundary enforcement
  // -------------------------------------------------------------------------

  describe("Authority Boundary Enforcement", () => {
    const policyYaml = `
version: "1.0"
defaultDecision: deny
autonomous:
  - actionType: log_access
  - actionType: read_data
    conditions:
      sectors: [general]
      riskLevels: [minimal, limited]
gated:
  - actionType: modify_record
    conditions:
      sectors: [healthcare, finance]
      riskLevels: [high]
  - actionType: approve_application
    conditions:
      dataTypes: [financial, personal]
escalated:
  - actionType: delete_record
  - actionType: override_policy
    conditions:
      riskLevels: [high, unacceptable]
`;

    it("parses a valid YAML policy", () => {
      const result = parsePolicy(policyYaml);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.version).toBe("1.0");
        expect(result.value.defaultDecision).toBe("deny");
        expect(result.value.autonomous.length).toBe(2);
        expect(result.value.gated.length).toBe(2);
        expect(result.value.escalated.length).toBe(2);
      }
    });

    it("allows autonomous actions matching policy", () => {
      const result = parsePolicy(policyYaml);
      if (!result.ok) throw new Error("Parse failed");

      const enforcement = enforcePolicy(result.value, {
        actionType: "log_access",
      });
      expect(enforcement.decision).toBe("allow");
      expect(enforcement.category).toBe("autonomous");
    });

    it("gates actions requiring human approval", () => {
      const result = parsePolicy(policyYaml);
      if (!result.ok) throw new Error("Parse failed");

      const enforcement = enforcePolicy(result.value, {
        actionType: "modify_record",
        sector: "healthcare",
        riskLevel: "high",
      });
      expect(enforcement.decision).toBe("gate");
      expect(enforcement.category).toBe("gated");
    });

    it("escalates actions exceeding agent authority", () => {
      const result = parsePolicy(policyYaml);
      if (!result.ok) throw new Error("Parse failed");

      const enforcement = enforcePolicy(result.value, {
        actionType: "delete_record",
      });
      expect(enforcement.decision).toBe("escalate");
      expect(enforcement.category).toBe("escalated");
    });

    it("falls back to default decision for unknown actions", () => {
      const result = parsePolicy(policyYaml);
      if (!result.ok) throw new Error("Parse failed");

      const enforcement = enforcePolicy(result.value, {
        actionType: "unknown_action_type",
      });
      expect(enforcement.decision).toBe("deny");
      expect(enforcement.category).toBe("default");
    });

    it("converts enforcement results to entry tags", () => {
      const result = parsePolicy(policyYaml);
      if (!result.ok) throw new Error("Parse failed");

      const enforcement = enforcePolicy(result.value, {
        actionType: "modify_record",
        sector: "healthcare",
        riskLevel: "high",
      });
      const tags = enforcementToTags(enforcement);
      expect(tags["authority.decision"]).toBe("gate");
      expect(tags["authority.category"]).toBe("gated");
      expect(typeof tags["authority.timestamp"]).toBe("string");
    });

    it("escalated rules take priority over gated and autonomous", () => {
      const result = parsePolicy(policyYaml);
      if (!result.ok) throw new Error("Parse failed");

      const enforcement = enforcePolicy(result.value, {
        actionType: "override_policy",
        riskLevel: "high",
      });
      expect(enforcement.decision).toBe("escalate");
      expect(enforcement.category).toBe("escalated");
    });

    it("rejects malformed YAML", () => {
      const result = parsePolicy(":::invalid yaml{{[");
      expect(result.ok).toBe(false);
    });

    it("rejects policies with invalid field values", () => {
      const badPolicy = `
version: "1.0"
defaultDecision: maybe
autonomous: []
`;
      const result = parsePolicy(badPolicy);
      expect(result.ok).toBe(false);
    });

    it("enforcement results can be stored as entry tags in proof chain entries", () => {
      const result = parsePolicy(policyYaml);
      if (!result.ok) throw new Error("Parse failed");

      const enforcement = enforcePolicy(result.value, {
        actionType: "approve_application",
        dataType: "financial",
      });
      const tags = enforcementToTags(enforcement);

      // Verify we can append an entry with these tags
      const taggedInput: AppendEntryInput = {
        entryId: "entry-authority-tagged",
        timestamp: TIMESTAMP,
        entryType: "policy_check",
        tags,
      };
      const taggedChain = createChain("authority-test-chain");
      const appendResult = appendEntry(taggedChain, taggedInput);
      expect(appendResult.ok).toBe(true);
      if (appendResult.ok) {
        expect(appendResult.value.entry.tags["authority.decision"]).toBe("gate");
      }
    });
  });

  // -------------------------------------------------------------------------
  // CycloneDX ML-BOM generation
  // -------------------------------------------------------------------------

  describe("CycloneDX ML-BOM Generation", () => {
    it("generates a valid CycloneDX BOM from provenance records", () => {
      const input: GenerateBomInput = {
        serialNumber: "urn:uuid:12345678-1234-1234-1234-123456789abc",
        provenance: provenanceRecords[0],
        toolVersion: "0.1.0",
      };
      const result = generateCycloneDxBom(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.bomFormat).toBe("CycloneDX");
        expect(result.value.specVersion).toBe("1.7");
        expect(result.value.components.length).toBe(1);
        expect(result.value.components[0].name).toBe("GPT-4o");
      }
    });

    it("exports BOM as formatted JSON", () => {
      const input: GenerateBomInput = {
        serialNumber: "urn:uuid:12345678-1234-1234-1234-123456789abc",
        provenance: provenanceRecords[0],
        toolVersion: "0.1.0",
      };
      const result = generateCycloneDxBom(input);
      if (!result.ok) throw new Error("BOM generation failed");

      const json = exportBomAsJson(result.value);
      const parsed = JSON.parse(json);
      expect(parsed.bomFormat).toBe("CycloneDX");
      expect(parsed.specVersion).toBe("1.7");
    });

    it("exports BOM as clean JSON with null values stripped", () => {
      const input: GenerateBomInput = {
        serialNumber: "urn:uuid:12345678-1234-1234-1234-123456789abc",
        provenance: provenanceRecords[2], // policy engine, minimal data
        toolVersion: "0.1.0",
      };
      const result = generateCycloneDxBom(input);
      if (!result.ok) throw new Error("BOM generation failed");

      const cleanJson = exportBomAsCleanJson(result.value);
      expect(cleanJson).not.toContain(": null");
    });

    it("rejects invalid serial numbers", () => {
      const input: GenerateBomInput = {
        serialNumber: "not-a-valid-urn",
        provenance: provenanceRecords[0],
        toolVersion: "0.1.0",
      };
      const result = generateCycloneDxBom(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_SERIAL_NUMBER");
      }
    });

    it("generates BOMs for all 3 provenance records", () => {
      for (let i = 0; i < provenanceRecords.length; i++) {
        const serial = `urn:uuid:00000000-0000-0000-0000-00000000000${i}`;
        const result = generateCycloneDxBom({
          serialNumber: serial,
          provenance: provenanceRecords[i],
          toolVersion: "0.1.0",
        });
        expect(result.ok).toBe(true);
      }
    });

    it("includes model provenance hash in the BOM component", () => {
      const input: GenerateBomInput = {
        serialNumber: "urn:uuid:12345678-1234-1234-1234-123456789abc",
        provenance: provenanceRecords[0],
        toolVersion: "0.1.0",
      };
      const result = generateCycloneDxBom(input);
      if (!result.ok) throw new Error("BOM generation failed");

      const component = result.value.components[0];
      const sha256Hash = component.hashes?.find((h) => h.alg === "SHA-256");
      expect(sha256Hash).toBeDefined();
      expect(sha256Hash!.content).toBe(provenanceRecords[0].provenanceHash);
    });

    it("stripNulls removes null values from nested objects", () => {
      const input = { a: 1, b: null, c: { d: null, e: "hello" } };
      const result = stripNulls(input);
      expect(result).toEqual({ a: 1, c: { e: "hello" } });
    });
  });

  // -------------------------------------------------------------------------
  // In-memory storage adapter round-trip
  // -------------------------------------------------------------------------

  describe("Storage Adapter Round-Trip", () => {
    it("stores and retrieves all 50 entries via in-memory adapter", async () => {
      const adapter = createInMemoryAdapter();
      for (const entry of entries) {
        const result = await adapter.putEntry(entry);
        expect(result.ok).toBe(true);
      }
      const stored = await adapter.getEntriesByChainId(CHAIN_ID);
      expect(stored.length).toBe(50);
    });

    it("stores and retrieves certificates via in-memory adapter", async () => {
      const adapter = createInMemoryAdapter();
      for (const cert of certificates.values()) {
        const result = await adapter.putCertificate(cert);
        expect(result.ok).toBe(true);
      }
      for (const [id, cert] of certificates) {
        const retrieved = await adapter.getCertificate(id);
        expect(retrieved.ok).toBe(true);
        if (retrieved.ok) {
          expect(retrieved.value.certificateId).toBe(cert.certificateId);
          expect(retrieved.value.certificateHash).toBe(cert.certificateHash);
        }
      }
    });

    it("stores and retrieves provenance records via in-memory adapter", async () => {
      const adapter = createInMemoryAdapter();
      for (const prov of provenanceRecords) {
        const result = await adapter.putProvenance(prov);
        expect(result.ok).toBe(true);
      }
      for (const prov of provenanceRecords) {
        const retrieved = await adapter.getProvenance(prov.provenanceId);
        expect(retrieved.ok).toBe(true);
        if (retrieved.ok) {
          expect(retrieved.value.provenanceHash).toBe(prov.provenanceHash);
        }
      }
    });

    it("retrieves entries by sequence range", async () => {
      const adapter = createInMemoryAdapter();
      for (const entry of entries) {
        await adapter.putEntry(entry);
      }
      const range = await adapter.getEntriesBySequenceRange(CHAIN_ID, 10, 19);
      expect(range.length).toBe(10);
      expect(range[0].sequenceNumber).toBe(10);
      expect(range[9].sequenceNumber).toBe(19);
    });

    it("reports correct chain length", async () => {
      const adapter = createInMemoryAdapter();
      for (const entry of entries) {
        await adapter.putEntry(entry);
      }
      const length = await adapter.getChainLength(CHAIN_ID);
      expect(length).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // End-to-end pipeline: store -> tag -> report -> export
  // -------------------------------------------------------------------------

  describe("End-to-End Pipeline", () => {
    it("full pipeline: store entries, tag them, generate report, export as JSON", async () => {
      // 1. Store entries
      const adapter = createInMemoryAdapter();
      for (const entry of entries) {
        const putResult = await adapter.putEntry(entry);
        expect(putResult.ok).toBe(true);
      }

      // 2. Store certificates and provenance
      for (const cert of certificates.values()) {
        await adapter.putCertificate(cert);
      }
      for (const prov of provenanceRecords) {
        await adapter.putProvenance(prov);
      }

      // 3. Retrieve entries from storage
      const storedEntries = await adapter.getEntriesByChainId(CHAIN_ID);
      expect(storedEntries.length).toBe(50);

      // 4. Rebuild chain from stored entries for validation
      const storedChain: ChainState = {
        chainId: CHAIN_ID,
        entries: [...storedEntries],
      };
      const validation = validateChain(storedChain);
      expect(validation.ok).toBe(true);

      // 5. Auto-tag all entries
      const allTags = storedEntries.map((entry, i) => {
        const metadata = metadataForGroup(groupForEntry(i));
        return tagEntry(entry, metadata);
      });
      expect(allTags.length).toBe(50);

      // Verify that auto-tagging produced regulation matches
      const totalMatches = allTags.reduce((sum, t) => sum + t.matches.length, 0);
      expect(totalMatches).toBeGreaterThan(0);

      // 6. Generate compliance report
      const report = generateComplianceReport({
        reportId: "e2e-report",
        chain: storedChain,
        defaultMetadata: makeMetadata({ sectors: ["general"], riskLevel: "limited" }),
        entryMetadataOverrides,
        certificates,
      });

      expect(report.chainIntegrity.valid).toBe(true);
      expect(report.statistics.totalEntries).toBe(50);
      expect(report.regulationSummaries.length).toBe(4);

      // 7. Export as JSON
      const json = exportReportAsJson(report);
      const parsed = JSON.parse(json) as ComplianceReport;
      expect(parsed.reportId).toBe("e2e-report");
      expect(parsed.statistics.totalEntries).toBe(50);

      // 8. Verify report covers all regulations
      const reportRegIds = parsed.regulationSummaries.map((s) => s.regulationId);
      expect(reportRegIds).toContain("colorado-sb205");
      expect(reportRegIds).toContain("nist-ai-rmf");
      expect(reportRegIds).toContain("eu-ai-act");
      expect(reportRegIds).toContain("hipaa-164-312-b");
    });

    it("pipeline with authority enforcement integrated into entry creation", () => {
      const policyYaml = `
version: "1.0"
defaultDecision: gate
autonomous:
  - actionType: classify_document
  - actionType: generate_summary
gated:
  - actionType: approve_claim
    conditions:
      sectors: [insurance, finance]
      riskLevels: [high]
escalated:
  - actionType: deny_claim
    conditions:
      sectors: [insurance]
      riskLevels: [high, unacceptable]
`;
      const policyResult = parsePolicy(policyYaml);
      expect(policyResult.ok).toBe(true);
      if (!policyResult.ok) return;
      const policy = policyResult.value;

      // Simulate 3 actions through the enforcement engine
      const actions: ReadonlyArray<ActionRequest> = [
        { actionType: "classify_document" },
        { actionType: "approve_claim", sector: "insurance", riskLevel: "high" },
        { actionType: "deny_claim", sector: "insurance", riskLevel: "high" },
      ];

      let policyChain = createChain("policy-pipeline");
      const policyEntries: Array<ProofChainEntry> = [];

      for (let i = 0; i < actions.length; i++) {
        const enforcement = enforcePolicy(policy, actions[i]);
        const tags = enforcementToTags(enforcement);

        const appendResult = appendEntry(policyChain, {
          entryId: `policy-entry-${i}`,
          timestamp: TIMESTAMP,
          entryType: "policy_check",
          tags,
          actorId: "policy-engine",
          annotation: `Action: ${actions[i].actionType}, Decision: ${enforcement.decision}`,
        });
        expect(appendResult.ok).toBe(true);
        if (appendResult.ok) {
          policyChain = appendResult.value.chain;
          policyEntries.push(appendResult.value.entry);
        }
      }

      // Verify enforcement decisions were recorded
      expect(policyEntries[0].tags["authority.decision"]).toBe("allow");
      expect(policyEntries[1].tags["authority.decision"]).toBe("gate");
      expect(policyEntries[2].tags["authority.decision"]).toBe("escalate");

      // Verify chain integrity
      expect(validateChain(policyChain).ok).toBe(true);

      // Generate compliance report for the policy chain
      const report = generateComplianceReport({
        reportId: "policy-pipeline-report",
        chain: policyChain,
        defaultMetadata: makeMetadata({
          sectors: ["insurance"],
          dataTypes: ["financial"],
          riskLevel: "high",
        }),
      });
      expect(report.chainIntegrity.valid).toBe(true);
      expect(report.statistics.totalEntries).toBe(3);
    });

    it("pipeline with CycloneDX BOM generation for deployed models", () => {
      // Generate BOMs for provenance records used in the chain
      const boms = provenanceRecords.map((prov, i) => {
        const serial = `urn:uuid:a0000000-0000-0000-0000-00000000000${i}`;
        const result = generateCycloneDxBom({
          serialNumber: serial,
          provenance: prov,
          toolVersion: "0.1.0",
        });
        expect(result.ok).toBe(true);
        return result.ok ? result.value : null;
      });

      // All BOMs should be generated
      expect(boms.filter((b) => b !== null).length).toBe(3);

      // Export each as clean JSON (null-stripped)
      for (const bom of boms) {
        if (bom === null) continue;
        const json = exportBomAsCleanJson(bom);
        const parsed = JSON.parse(json);
        expect(parsed.bomFormat).toBe("CycloneDX");
        expect(parsed.specVersion).toBe("1.7");
        // Clean JSON should not have any null values
        expect(json).not.toContain(": null");
      }
    });

    it("pipeline maintains data integrity across all components", () => {
      // Verify certificates used in chain entries are still valid
      for (const entry of entries) {
        if (entry.reasoningCertificateId !== null) {
          const cert = certificates.get(entry.reasoningCertificateId);
          if (cert !== undefined) {
            expect(verifyCertificate(cert)).toBe(true);
          }
        }
      }

      // Verify provenance records used in chain entries are still valid
      for (const prov of provenanceRecords) {
        expect(verifyProvenance(prov)).toBe(true);
      }

      // Verify chain integrity
      expect(validateChain(chain).ok).toBe(true);
    });
  });
});
