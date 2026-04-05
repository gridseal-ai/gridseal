import type {
  ChainSummary,
  PaginatedEntries,
  ProofChainEntry,
  ValidationResult,
  ReasoningCertificate,
  ModelProvenance,
} from "../types.ts";

type ApiError = {
  readonly error: string;
  readonly details?: unknown;
};

type ApiResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

const DEFAULT_BASE_URL = "/api";

/** Fetch wrapper that returns a typed result. */
async function request<T>(
  path: string,
  options: RequestInit = {},
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<ApiResult<T>> {
  const url = `${baseUrl}${path}`;
  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const err = body as ApiError;
      return { ok: false, error: err.error ?? `HTTP ${response.status}` };
    }
    return { ok: true, value: body as T };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: message };
  }
}

/** List all chains with entry counts. */
export async function listChains(
  baseUrl?: string,
): Promise<ApiResult<{ chains: ReadonlyArray<ChainSummary> }>> {
  return request("/chains", {}, baseUrl);
}

/** Get chain metadata. */
export async function getChain(
  chainId: string,
  baseUrl?: string,
): Promise<ApiResult<ChainSummary>> {
  return request(`/chains/${encodeURIComponent(chainId)}`, {}, baseUrl);
}

/** Get paginated entries for a chain. */
export async function getChainEntries(
  chainId: string,
  offset: number = 0,
  limit: number = 100,
  baseUrl?: string,
): Promise<ApiResult<PaginatedEntries>> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  return request(
    `/chains/${encodeURIComponent(chainId)}/entries?${params.toString()}`,
    {},
    baseUrl,
  );
}

/** Get a single entry. */
export async function getEntry(
  chainId: string,
  entryId: string,
  baseUrl?: string,
): Promise<ApiResult<{ entry: ProofChainEntry }>> {
  return request(
    `/chains/${encodeURIComponent(chainId)}/entries/${encodeURIComponent(entryId)}`,
    {},
    baseUrl,
  );
}

/** Validate an entire chain. */
export async function validateChain(
  chainId: string,
  baseUrl?: string,
): Promise<ApiResult<ValidationResult>> {
  return request(
    `/chains/${encodeURIComponent(chainId)}/validate`,
    { method: "POST" },
    baseUrl,
  );
}

/** Validate a single entry. */
export async function validateEntry(
  chainId: string,
  entryId: string,
  baseUrl?: string,
): Promise<ApiResult<{ valid: boolean; entryId: string; error?: unknown }>> {
  return request(
    `/chains/${encodeURIComponent(chainId)}/entries/${encodeURIComponent(entryId)}/validate`,
    { method: "POST" },
    baseUrl,
  );
}

/** Get a reasoning certificate. */
export async function getCertificate(
  certificateId: string,
  baseUrl?: string,
): Promise<ApiResult<{ certificate: ReasoningCertificate }>> {
  return request(
    `/certificates/${encodeURIComponent(certificateId)}`,
    {},
    baseUrl,
  );
}

/** Verify a certificate's integrity. */
export async function verifyCertificate(
  certificateId: string,
  baseUrl?: string,
): Promise<ApiResult<{ valid: boolean; certificateId: string }>> {
  return request(
    `/certificates/${encodeURIComponent(certificateId)}/verify`,
    { method: "POST" },
    baseUrl,
  );
}

/** Get a model provenance record. */
export async function getProvenance(
  provenanceId: string,
  baseUrl?: string,
): Promise<ApiResult<{ provenance: ModelProvenance }>> {
  return request(
    `/provenance/${encodeURIComponent(provenanceId)}`,
    {},
    baseUrl,
  );
}

/** Verify a provenance record's integrity. */
export async function verifyProvenance(
  provenanceId: string,
  baseUrl?: string,
): Promise<ApiResult<{ valid: boolean; provenanceId: string }>> {
  return request(
    `/provenance/${encodeURIComponent(provenanceId)}/verify`,
    { method: "POST" },
    baseUrl,
  );
}
