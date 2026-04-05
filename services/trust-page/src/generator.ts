import type { StorageAdapter, Result } from "@gridseal/core";
import { ok, err, getRegulationIds } from "@gridseal/core";
import type { TrustPageData } from "./aggregate.js";
import { aggregateTrustPageData } from "./aggregate.js";
import { renderTrustPage } from "./render.js";

/** Errors that can occur during trust page generation. */
export type GeneratorError =
  | { readonly type: "CHAIN_EMPTY"; readonly chainId: string }
  | { readonly type: "STORAGE_ERROR"; readonly message: string };

/** Options for controlling trust page generation. */
export type GenerateOptions = {
  /** Chain ID to generate the trust page for. */
  readonly chainId: string;
  /** Certificate IDs to include. If omitted, attempts to discover from entries. */
  readonly certificateIds?: ReadonlyArray<string> | undefined;
  /** Provenance IDs to include. If omitted, attempts to discover from entries. */
  readonly provenanceIds?: ReadonlyArray<string> | undefined;
  /** Regulation IDs to check availability for. If omitted, uses all registered regulations. */
  readonly regulationIds?: ReadonlyArray<string> | undefined;
};

/** Result of generating a trust page. */
export type GenerateResult = {
  readonly html: string;
  readonly data: TrustPageData;
};

function discoverCertificateIds(
  entries: ReadonlyArray<{ readonly reasoningCertificateId: string | null }>,
): ReadonlyArray<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.reasoningCertificateId !== null) {
      ids.add(entry.reasoningCertificateId);
    }
  }
  return [...ids];
}

function discoverProvenanceIds(
  entries: ReadonlyArray<{ readonly provenanceId: string | null }>,
): ReadonlyArray<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.provenanceId !== null) {
      ids.add(entry.provenanceId);
    }
  }
  return [...ids];
}

async function loadCertificates(
  storage: StorageAdapter,
  ids: ReadonlyArray<string>,
): Promise<ReadonlyArray<import("@gridseal/core").ReasoningCertificate>> {
  const certs: import("@gridseal/core").ReasoningCertificate[] = [];
  for (const id of ids) {
    const result = await storage.getCertificate(id);
    if (result.ok) {
      certs.push(result.value);
    }
  }
  return certs;
}

async function loadProvenance(
  storage: StorageAdapter,
  ids: ReadonlyArray<string>,
): Promise<ReadonlyArray<import("@gridseal/core").ModelProvenance>> {
  const records: import("@gridseal/core").ModelProvenance[] = [];
  for (const id of ids) {
    const result = await storage.getProvenance(id);
    if (result.ok) {
      records.push(result.value);
    }
  }
  return records;
}

/**
 * Generate a self-contained Trust Page HTML document for a chain.
 * Loads chain data, certificates, and provenance from storage,
 * aggregates statistics, and renders HTML.
 */
export async function generateTrustPage(
  storage: StorageAdapter,
  options: GenerateOptions,
): Promise<Result<GenerateResult, GeneratorError>> {
  const { chainId } = options;
  const entries = await storage.getEntriesByChainId(chainId);
  if (entries.length === 0) {
    return err({ type: "CHAIN_EMPTY", chainId });
  }

  const chain = { chainId, entries: [...entries] };
  const certIds = options.certificateIds ?? discoverCertificateIds(entries);
  const provIds = options.provenanceIds ?? discoverProvenanceIds(entries);
  const regulationIds = options.regulationIds ?? [...getRegulationIds()];

  const [certificates, provenanceRecords] = await Promise.all([
    loadCertificates(storage, certIds),
    loadProvenance(storage, provIds),
  ]);

  const data = aggregateTrustPageData(
    chain,
    certificates,
    provenanceRecords,
    regulationIds,
  );
  const html = renderTrustPage(data);
  return ok({ html, data });
}

/**
 * Generate trust page data without rendering HTML.
 * Useful for consumers that need the structured data (e.g., JSON API).
 */
export async function generateTrustPageData(
  storage: StorageAdapter,
  options: GenerateOptions,
): Promise<Result<TrustPageData, GeneratorError>> {
  const result = await generateTrustPage(storage, options);
  if (!result.ok) {
    return result;
  }
  return ok(result.value.data);
}
