import type {
  ReasoningCertificate,
  ModelProvenance,
} from "@gridseal/core";
import type { CertificateSummary, ProvenanceSummary } from "./aggregate-types.js";

/** Summarize a reasoning certificate for display. */
export function summarizeCertificate(
  cert: ReasoningCertificate,
): CertificateSummary {
  return {
    certificateId: cert.certificateId,
    modelId: cert.modelId,
    timestamp: cert.timestamp,
    claimCount: cert.claims.length,
    unsupportedClaimCount: cert.unsupportedClaims.length,
    confidenceLevel: cert.confidenceAssessment.level,
    confidenceScore: cert.confidenceAssessment.score,
  };
}

/** Summarize a provenance record for display. */
export function summarizeProvenance(
  prov: ModelProvenance,
): ProvenanceSummary {
  return {
    provenanceId: prov.provenanceId,
    modelName: prov.modelName,
    modelVersion: prov.modelVersion,
    modelProvider: prov.modelProvider,
    datasetCount: prov.trainingDatasets.length,
    metricCount: prov.performanceMetrics.length,
    ethicalConsiderationCount: prov.ethicalConsiderations.length,
  };
}
