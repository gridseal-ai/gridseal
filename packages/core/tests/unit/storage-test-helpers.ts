import {
  createChain,
  appendEntry,
} from "../../src/chain/proof-chain.js";
import { createCertificate } from "../../src/certificate/reasoning-certificate.js";
import { createProvenance } from "../../src/provenance/model-provenance.js";
import type { ProofChainEntry } from "../../src/schema/proof-chain-entry.js";
import type { ReasoningCertificate } from "../../src/certificate/reasoning-certificate.js";
import type { ModelProvenance } from "../../src/provenance/model-provenance.js";
import type { AppendEntryInput, ChainState } from "../../src/chain/proof-chain.js";
import type { EntryType } from "../../src/schema/entry-types.js";

export { createChain, appendEntry };
export type { ProofChainEntry, AppendEntryInput, ChainState, EntryType };
export type { ReasoningCertificate, ModelProvenance };

export function makeInput(
  overrides: Partial<AppendEntryInput> & { entryId: string }
): AppendEntryInput {
  return {
    timestamp: "2026-04-04T00:00:00.000Z",
    entryType: "ai_decision" as EntryType,
    ...overrides,
  };
}

export function appendN(
  chain: ChainState,
  count: number,
  prefix = "entry"
): { chain: ChainState; entries: ReadonlyArray<ProofChainEntry> } {
  let current = chain;
  const entries: Array<ProofChainEntry> = [];
  for (let i = 0; i < count; i++) {
    const result = appendEntry(
      current,
      makeInput({ entryId: `${prefix}-${i}` })
    );
    if (!result.ok) {
      throw new Error(`Failed to append entry ${i}: ${result.error.type}`);
    }
    current = result.value.chain;
    entries.push(result.value.entry);
  }
  return { chain: current, entries };
}

export function makeCertificate(id: string): ReasoningCertificate {
  return createCertificate({
    certificateId: id,
    timestamp: "2026-04-04T00:00:00.000Z",
    modelId: "test-model",
    modelProvider: "test-provider",
    claims: [
      {
        claimId: "claim-1",
        statement: "Test claim",
        supportingEvidenceIds: ["ev-1"],
      },
    ],
    supportingEvidence: [
      {
        evidenceId: "ev-1",
        evidenceType: "data_observation",
        description: "Test evidence",
        source: null,
      },
    ],
    unsupportedClaims: [],
    assumptions: [],
    limitations: [],
    confidenceAssessment: {
      level: "high",
      score: 0.9,
      rationale: "Test rationale",
    },
  });
}

export function makeProvenance(id: string): ModelProvenance {
  return createProvenance({
    provenanceId: id,
    timestamp: "2026-04-04T00:00:00.000Z",
    bomVersion: "1.7",
    modelName: "test-model",
    modelVersion: "1.0",
    modelType: "generative",
    modelProvider: "test-provider",
    modelDescription: "A test model",
    modelAuthor: null,
    modelLicense: "Apache-2.0",
    trainingDatasets: [],
    performanceMetrics: [],
    ethicalConsiderations: [],
    externalReferences: [],
  });
}
