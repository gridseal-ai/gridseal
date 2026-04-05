import type {
  ChainSummary,
  EntryListResponse,
  EntryFilters,
  ProofChainEntry,
  ValidationResult,
  ReasoningCertificate,
} from "../types.js";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, (body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function fetchChains(): Promise<{ chains: ChainSummary[] }> {
  return request("/chains");
}

export function fetchEntries(
  chainId: string,
  offset: number,
  limit: number,
  filters?: EntryFilters,
): Promise<EntryListResponse> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  if (filters?.startDate) params.set("startDate", filters.startDate);
  if (filters?.endDate) params.set("endDate", filters.endDate);
  if (filters?.modelId) params.set("modelId", filters.modelId);
  if (filters?.actorId) params.set("actorId", filters.actorId);
  if (filters?.sessionId) params.set("sessionId", filters.sessionId);
  return request(`/chains/${chainId}/entries?${params.toString()}`);
}

export function fetchEntry(
  chainId: string,
  entryId: string,
): Promise<{ entry: ProofChainEntry }> {
  return request(`/chains/${chainId}/entries/${entryId}`);
}

export function fetchEntryChildren(
  chainId: string,
  entryId: string,
): Promise<{ parentEntryId: string; children: ProofChainEntry[] }> {
  return request(`/chains/${chainId}/entries/${entryId}/children`);
}

export function fetchEntrySubtree(
  chainId: string,
  entryId: string,
): Promise<{ rootEntryId: string; entries: ProofChainEntry[] }> {
  return request(`/chains/${chainId}/entries/${entryId}/subtree`);
}

export function validateChain(chainId: string): Promise<ValidationResult> {
  return request(`/chains/${chainId}/validate`, { method: "POST" });
}

export function fetchCertificate(
  certificateId: string,
): Promise<{ certificate: ReasoningCertificate }> {
  return request(`/certificates/${certificateId}`);
}

export function fetchRegulations(): Promise<{ regulations: string[] }> {
  return request("/reports");
}

export function fetchReport(
  regulation: string,
  chainId: string,
): Promise<{ report: Record<string, unknown> }> {
  return request(`/reports/${regulation}?chainId=${chainId}`);
}
