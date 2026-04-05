import { z } from "zod";
import { ENTRY_TYPES, DECISION_TYPES } from "@gridseal/core";
import { CONFIDENCE_LEVELS } from "@gridseal/core";
import { MODEL_TYPES } from "@gridseal/core";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;
const isoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const uuidString = z.string().regex(uuidPattern, "Must be a valid UUID");
const sha256String = z.string().regex(sha256Pattern, "Must be a valid SHA-256 hex string");
const isoTimestamp = z.string().regex(isoTimestampPattern, "Must be a valid ISO 8601 timestamp");

/** Schema for appending an entry to a chain. */
export const appendEntrySchema = z.object({
  entryId: uuidString,
  timestamp: isoTimestamp,
  entryType: z.enum(ENTRY_TYPES),
  parentEntryId: z.string().nullable().optional(),
  modelId: z.string().nullable().optional(),
  modelProvider: z.string().nullable().optional(),
  inputHash: sha256String.nullable().optional(),
  outputHash: sha256String.nullable().optional(),
  inputTokenCount: z.number().int().nonnegative().nullable().optional(),
  outputTokenCount: z.number().int().nonnegative().nullable().optional(),
  decisionType: z.enum(DECISION_TYPES).nullable().optional(),
  confidenceScore: z.number().min(0).max(1).nullable().optional(),
  reasoningCertificateId: z.string().nullable().optional(),
  provenanceId: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  actorId: z.string().nullable().optional(),
  policyIds: z.array(z.string()).optional(),
  tags: z.record(z.string()).optional(),
  annotation: z.string().nullable().optional(),
  complianceMetadata: z.record(z.unknown()).optional(),
});

export type AppendEntryBody = z.infer<typeof appendEntrySchema>;

const claimSchema = z.object({
  claimId: z.string(),
  statement: z.string(),
  supportingEvidenceIds: z.array(z.string()),
});

const evidenceSchema = z.object({
  evidenceId: z.string(),
  evidenceType: z.string(),
  description: z.string(),
  source: z.string().nullable(),
});

const unsupportedClaimSchema = z.object({
  statement: z.string(),
  reason: z.string(),
});

const assumptionSchema = z.object({
  statement: z.string(),
  criticality: z.enum(["low", "medium", "high"]),
});

const limitationSchema = z.object({
  description: z.string(),
  impact: z.string(),
});

const confidenceAssessmentSchema = z.object({
  level: z.enum(CONFIDENCE_LEVELS),
  score: z.number().min(0).max(1),
  rationale: z.string(),
});

/** Schema for creating a reasoning certificate. */
export const createCertificateSchema = z.object({
  certificateId: uuidString,
  timestamp: isoTimestamp,
  modelId: z.string(),
  modelProvider: z.string(),
  claims: z.array(claimSchema),
  supportingEvidence: z.array(evidenceSchema),
  unsupportedClaims: z.array(unsupportedClaimSchema),
  assumptions: z.array(assumptionSchema),
  limitations: z.array(limitationSchema),
  confidenceAssessment: confidenceAssessmentSchema,
});

export type CreateCertificateBody = z.infer<typeof createCertificateSchema>;

const datasetReferenceSchema = z.object({
  datasetId: z.string(),
  name: z.string(),
  version: z.string().nullable(),
  source: z.string().nullable(),
  description: z.string().nullable(),
});

const performanceMetricSchema = z.object({
  metricId: z.string(),
  name: z.string(),
  value: z.number(),
  slice: z.string().nullable(),
  confidenceInterval: z.object({
    lower: z.number(),
    upper: z.number(),
  }).nullable(),
});

const ethicalConsiderationSchema = z.object({
  category: z.string(),
  description: z.string(),
  mitigationStrategy: z.string().nullable(),
});

const externalReferenceSchema = z.object({
  referenceType: z.string(),
  url: z.string(),
  description: z.string().nullable(),
});

/** Schema for creating a model provenance record. */
export const createProvenanceSchema = z.object({
  provenanceId: uuidString,
  timestamp: isoTimestamp,
  bomVersion: z.string(),
  modelName: z.string(),
  modelVersion: z.string(),
  modelType: z.enum(MODEL_TYPES),
  modelProvider: z.string(),
  modelDescription: z.string().nullable(),
  modelAuthor: z.string().nullable(),
  modelLicense: z.string().nullable(),
  trainingDatasets: z.array(datasetReferenceSchema),
  performanceMetrics: z.array(performanceMetricSchema),
  ethicalConsiderations: z.array(ethicalConsiderationSchema),
  externalReferences: z.array(externalReferenceSchema),
});

export type CreateProvenanceBody = z.infer<typeof createProvenanceSchema>;

/** Schema for pagination query parameters. */
export const paginationSchema = z.object({
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(1000).default(100),
});
