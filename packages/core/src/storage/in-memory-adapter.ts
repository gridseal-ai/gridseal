import type { ProofChainEntry } from "../schema/proof-chain-entry.js";
import type { ReasoningCertificate } from "../certificate/reasoning-certificate.js";
import type { ModelProvenance } from "../provenance/model-provenance.js";
import type { Result } from "../schema/result.js";
import { ok, err } from "../schema/result.js";
import type { StorageAdapter, StorageError } from "./storage-adapter.js";

/** Create an in-memory storage adapter backed by Maps. */
export function createInMemoryAdapter(): StorageAdapter {
  const entries = new Map<string, ProofChainEntry>();
  const chainIndex = new Map<string, Array<string>>();
  const certificates = new Map<string, ReasoningCertificate>();
  const provenance = new Map<string, ModelProvenance>();

  function putEntry(
    entry: ProofChainEntry
  ): Promise<Result<ProofChainEntry, StorageError>> {
    if (entries.has(entry.entryId)) {
      return Promise.resolve(
        err({ type: "DUPLICATE_ENTRY" as const, entryId: entry.entryId })
      );
    }

    entries.set(entry.entryId, entry);

    const chainEntries = chainIndex.get(entry.chainId);
    if (chainEntries) {
      chainEntries.push(entry.entryId);
    } else {
      chainIndex.set(entry.chainId, [entry.entryId]);
    }

    return Promise.resolve(ok(entry));
  }

  function getEntry(
    entryId: string
  ): Promise<Result<ProofChainEntry, StorageError>> {
    const entry = entries.get(entryId);
    if (!entry) {
      return Promise.resolve(
        err({ type: "ENTRY_NOT_FOUND" as const, entryId })
      );
    }
    return Promise.resolve(ok(entry));
  }

  function getEntriesByChainId(
    chainId: string
  ): Promise<ReadonlyArray<ProofChainEntry>> {
    const entryIds = chainIndex.get(chainId);
    if (!entryIds) {
      return Promise.resolve([]);
    }

    const result: Array<ProofChainEntry> = [];
    for (const id of entryIds) {
      const entry = entries.get(id);
      if (entry) {
        result.push(entry);
      }
    }

    result.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    return Promise.resolve(result);
  }

  function getEntriesBySequenceRange(
    chainId: string,
    startSequence: number,
    endSequence: number
  ): Promise<ReadonlyArray<ProofChainEntry>> {
    const entryIds = chainIndex.get(chainId);
    if (!entryIds) {
      return Promise.resolve([]);
    }

    const result: Array<ProofChainEntry> = [];
    for (const id of entryIds) {
      const entry = entries.get(id);
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
    parentEntryId: string
  ): Promise<ReadonlyArray<ProofChainEntry>> {
    const result: Array<ProofChainEntry> = [];
    for (const entry of entries.values()) {
      if (entry.parentEntryId === parentEntryId) {
        result.push(entry);
      }
    }
    result.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    return Promise.resolve(result);
  }

  function putCertificate(
    certificate: ReasoningCertificate
  ): Promise<Result<ReasoningCertificate, StorageError>> {
    if (certificates.has(certificate.certificateId)) {
      return Promise.resolve(
        err({
          type: "DUPLICATE_CERTIFICATE" as const,
          certificateId: certificate.certificateId,
        })
      );
    }
    certificates.set(certificate.certificateId, certificate);
    return Promise.resolve(ok(certificate));
  }

  function getCertificate(
    certificateId: string
  ): Promise<Result<ReasoningCertificate, StorageError>> {
    const cert = certificates.get(certificateId);
    if (!cert) {
      return Promise.resolve(
        err({ type: "CERTIFICATE_NOT_FOUND" as const, certificateId })
      );
    }
    return Promise.resolve(ok(cert));
  }

  function putProvenance(
    prov: ModelProvenance
  ): Promise<Result<ModelProvenance, StorageError>> {
    if (provenance.has(prov.provenanceId)) {
      return Promise.resolve(
        err({
          type: "DUPLICATE_PROVENANCE" as const,
          provenanceId: prov.provenanceId,
        })
      );
    }
    provenance.set(prov.provenanceId, prov);
    return Promise.resolve(ok(prov));
  }

  function getProvenance(
    provenanceId: string
  ): Promise<Result<ModelProvenance, StorageError>> {
    const prov = provenance.get(provenanceId);
    if (!prov) {
      return Promise.resolve(
        err({ type: "PROVENANCE_NOT_FOUND" as const, provenanceId })
      );
    }
    return Promise.resolve(ok(prov));
  }

  function getChainLength(chainId: string): Promise<number> {
    const entryIds = chainIndex.get(chainId);
    return Promise.resolve(entryIds ? entryIds.length : 0);
  }

  function listChainIds(): Promise<ReadonlyArray<string>> {
    return Promise.resolve(Array.from(chainIndex.keys()));
  }

  function clear(): Promise<void> {
    entries.clear();
    chainIndex.clear();
    certificates.clear();
    provenance.clear();
    return Promise.resolve();
  }

  return {
    putEntry,
    getEntry,
    getEntriesByChainId,
    getEntriesBySequenceRange,
    getEntriesByParentId,
    putCertificate,
    getCertificate,
    putProvenance,
    getProvenance,
    getChainLength,
    listChainIds,
    clear,
  };
}
