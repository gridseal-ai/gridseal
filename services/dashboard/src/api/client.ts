import type {
  ChainsListResponse,
  ChainSummary,
  ChainEntriesResponse,
  ProofChainEntry,
  ValidationResult,
  EntryValidationResult,
  ReasoningCertificate,
  CertificateVerifyResult,
  ModelProvenance,
  ProvenanceVerifyResult,
} from "./types";

type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string };

const BASE_URL = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });

    const body = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const message = typeof body["error"] === "string"
        ? body["error"]
        : `Request failed with status ${String(response.status)}`;
      return { ok: false, error: message };
    }

    return { ok: true, data: body as T };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}

export async function listChains(): Promise<ApiResult<ChainsListResponse>> {
  return request<ChainsListResponse>("/chains/");
}

export async function getChain(chainId: string): Promise<ApiResult<ChainSummary>> {
  return request<ChainSummary>(`/chains/${encodeURIComponent(chainId)}`);
}

export async function getChainEntries(
  chainId: string,
  offset = 0,
  limit = 100,
): Promise<ApiResult<ChainEntriesResponse>> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  return request<ChainEntriesResponse>(
    `/chains/${encodeURIComponent(chainId)}/entries?${params.toString()}`,
  );
}

export async function getEntry(
  chainId: string,
  entryId: string,
): Promise<ApiResult<{ entry: ProofChainEntry }>> {
  return request(`/chains/${encodeURIComponent(chainId)}/entries/${encodeURIComponent(entryId)}`);
}

export async function getEntryChildren(
  chainId: string,
  entryId: string,
): Promise<ApiResult<{ parentEntryId: string; children: ReadonlyArray<ProofChainEntry> }>> {
  return request(
    `/chains/${encodeURIComponent(chainId)}/entries/${encodeURIComponent(entryId)}/children`,
  );
}

export async function validateChain(chainId: string): Promise<ApiResult<ValidationResult>> {
  return request<ValidationResult>(`/chains/${encodeURIComponent(chainId)}/validate`, {
    method: "POST",
  });
}

export async function validateEntry(
  chainId: string,
  entryId: string,
): Promise<ApiResult<EntryValidationResult>> {
  return request<EntryValidationResult>(
    `/chains/${encodeURIComponent(chainId)}/entries/${encodeURIComponent(entryId)}/validate`,
    { method: "POST" },
  );
}

export async function getCertificate(
  certificateId: string,
): Promise<ApiResult<{ certificate: ReasoningCertificate }>> {
  return request(`/certificates/${encodeURIComponent(certificateId)}`);
}

export async function verifyCertificate(
  certificateId: string,
): Promise<ApiResult<CertificateVerifyResult>> {
  return request<CertificateVerifyResult>(
    `/certificates/${encodeURIComponent(certificateId)}/verify`,
    { method: "POST" },
  );
}

export async function getProvenance(
  provenanceId: string,
): Promise<ApiResult<{ provenance: ModelProvenance }>> {
  return request(`/provenance/${encodeURIComponent(provenanceId)}`);
}

export async function verifyProvenance(
  provenanceId: string,
): Promise<ApiResult<ProvenanceVerifyResult>> {
  return request<ProvenanceVerifyResult>(
    `/provenance/${encodeURIComponent(provenanceId)}/verify`,
    { method: "POST" },
  );
}

export async function checkHealth(): Promise<ApiResult<{ status: string; timestamp: string }>> {
  return request("/health/");
}
