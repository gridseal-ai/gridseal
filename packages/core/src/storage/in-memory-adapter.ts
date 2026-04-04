import type { ProofChainEntry } from "../schema/proof-chain-entry.js";
import type { ReasoningCertificate } from "../certificate/reasoning-certificate.js";
import type { ModelProvenance } from "../provenance/model-provenance.js";
import type { Result } from "../schema/result.js";
import { ok, err } from "../schema/result.js";
import type { StorageAdapter, StorageError } from "./storage-adapter.js";

type MemoryState = {
  readonly entries: Map<string, ProofChainEntry>;
  readonly chainIndex: Map<string, Array<string>>;
  readonly certificates: Map<string, ReasoningCertificate>;
  readonly provenance: Map<string, ModelProvenance>;
};

function putEntry(
  state: MemoryState,
  entry: ProofChainEntry
): Promise<Result<ProofChainEntry, StorageError>> {
  if (state.entries.has(entry.entryId)) {
    return Promise.resolve(
      err({ type: "DUPLICATE_ENTRY" as const, entryId: entry.entryId })
    );
  }

  state.entries.set(entry.entryId, entry);

  const chainEntries = state.chainIndex.get(entry.chainId);
  if (chainEntries) {
    chainEntries.push(entry.entryId);
  } else {
    state.chainIndex.set(entry.chainId, [entry.entryId]);
  }

  return Promise.resolve(ok(entry));
}

function getEntry(
  state: MemoryState,
  entryId: string
): Promise<Result<ProofChainEntry, StorageError>> {
  const entry = state.entries.get(entryId);
  if (!entry) {
    return Promise.resolve(
      err({ type: "ENTRY_NOT_FOUND" as const, entryId })
    );
  }
  return Promise.resolve(ok(entry));
}

function getEntriesByChainId(
  state: MemoryState,
  chainId: string
): Promise<ReadonlyArray<ProofChainEntry>> {
  const entryIds = state.chainIndex.get(chainId);
  if (!entryIds) {
    return Promise.resolve([]);
  }

  const result: Array<ProofChainEntry> = [];
  for (const id of entryIds) {
    const entry = state.entries.get(id);
    if (entry) {
      result.push(entry);
    }
  }

  result.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  return Promise.resolve(result);
}

function getEntriesBySequenceRange(
  state: MemoryState,
  chainId: string,
  startSequence: number,
  endSequence: number
): Promise<ReadonlyArray<ProofChainEntry>> {
  const entryIds = state.chainIndex.get(chainId);
  if (!entryIds) {
    return Promise.resolve([]);
  }

  const result: Array<ProofChainEntry> = [];
  for (const id of entryIds) {
    const entry = state.entries.get(id);
    if (
      entry &&
      entry.sequenceNumber >= startSequence &&
      entry.sequenceNumber <= endSequence
    ) {
      result.push(entry);
    }
  }

  result.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  return Promise.resolve(result);
}

function getEntriesByParentId(
  state: MemoryState,
  parentEntryId: string
): Promise<ReadonlyArray<ProofChainEntry>> {
  const result: Array<ProofChainEntry> = [];
  for (const entry of state.entries.values()) {
    if (entry.parentEntryId === parentEntryId) {
      result.push(entry);
    }
  }
  result.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  return Promise.resolve(result);
}

function putCertificate(
  state: MemoryState,
  certificate: ReasoningCertificate
): Promise<Result<ReasoningCertificate, StorageError>> {
  if (state.certificates.has(certificate.certificateId)) {
    return Promise.resolve(
      err({
        type: "DUPLICATE_CERTIFICATE" as const,
        certificateId: certificate.certificateId,
      })
    );
  }
  state.certificates.set(certificate.certificateId, certificate);
  return Promise.resolve(ok(certificate));
}

function getCertificate(
  state: MemoryState,
  certificateId: string
): Promise<Result<ReasoningCertificate, StorageError>> {
  const cert = state.certificates.get(certificateId);
  if (!cert) {
    return Promise.resolve(
      err({ type: "CERTIFICATE_NOT_FOUND" as const, certificateId })
    );
  }
  return Promise.resolve(ok(cert));
}

function putProvenance(
  state: MemoryState,
  prov: ModelProvenance
): Promise<Result<ModelProvenance, StorageError>> {
  if (state.provenance.has(prov.provenanceId)) {
    return Promise.resolve(
      err({
        type: "DUPLICATE_PROVENANCE" as const,
        provenanceId: prov.provenanceId,
      })
    );
  }
  state.provenance.set(prov.provenanceId, prov);
  return Promise.resolve(ok(prov));
}

function getProvenance(
  state: MemoryState,
  provenanceId: string
): Promise<Result<ModelProvenance, StorageError>> {
  const prov = state.provenance.get(provenanceId);
  if (!prov) {
    return Promise.resolve(
      err({ type: "PROVENANCE_NOT_FOUND" as const, provenanceId })
    );
  }
  return Promise.resolve(ok(prov));
}

/** Create an in-memory storage adapter backed by Maps. */
export function createInMemoryAdapter(): StorageAdapter {
  const state: MemoryState = {
    entries: new Map(),
    chainIndex: new Map(),
    certificates: new Map(),
    provenance: new Map(),
  };

  return {
    putEntry: (entry) => putEntry(state, entry),
    getEntry: (entryId) => getEntry(state, entryId),
    getEntriesByChainId: (chainId) => getEntriesByChainId(state, chainId),
    getEntriesBySequenceRange: (chainId, start, end) =>
      getEntriesBySequenceRange(state, chainId, start, end),
    getEntriesByParentId: (parentId) =>
      getEntriesByParentId(state, parentId),
    putCertificate: (cert) => putCertificate(state, cert),
    getCertificate: (certId) => getCertificate(state, certId),
    putProvenance: (prov) => putProvenance(state, prov),
    getProvenance: (provId) => getProvenance(state, provId),
    getChainLength: (chainId) => {
      const entryIds = state.chainIndex.get(chainId);
      return Promise.resolve(entryIds ? entryIds.length : 0);
    },
    listChainIds: () =>
      Promise.resolve(Array.from(state.chainIndex.keys())),
    clear: () => {
      state.entries.clear();
      state.chainIndex.clear();
      state.certificates.clear();
      state.provenance.clear();
      return Promise.resolve();
    },
  };
}
