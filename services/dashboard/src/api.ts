const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export type ChainSummary = {
  readonly chainId: string;
  readonly entryCount: number;
};

export type ChainListResponse = {
  readonly chains: ReadonlyArray<ChainSummary>;
};

export type ProofChainEntry = {
  readonly entryId: string;
  readonly chainId: string;
  readonly sequenceNumber: number;
  readonly timestamp: string;
  readonly entryType: string;
  readonly entryHash: string;
  readonly previousHash: string | null;
  readonly parentEntryId: string | null;
  readonly modelId: string | null;
  readonly modelProvider: string | null;
  readonly inputHash: string | null;
  readonly outputHash: string | null;
  readonly inputTokenCount: number | null;
  readonly outputTokenCount: number | null;
  readonly decisionType: string | null;
  readonly confidenceScore: number | null;
  readonly reasoningCertificateId: string | null;
  readonly provenanceId: string | null;
  readonly sessionId: string | null;
  readonly actorId: string | null;
  readonly policyIds: ReadonlyArray<string>;
  readonly tags: Readonly<Record<string, string>>;
  readonly annotation: string | null;
  readonly complianceMetadata: Readonly<Record<string, unknown>>;
};

export type EntryListResponse = {
  readonly chainId: string;
  readonly entries: ReadonlyArray<ProofChainEntry>;
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
};

export type EntryResponse = {
  readonly entry: ProofChainEntry;
};

export type ValidationResult = {
  readonly valid: boolean;
  readonly chainId: string;
  readonly entryCount: number;
  readonly error?: {
    readonly type: string;
    readonly message: string;
  } | undefined;
};

export type ReasoningCertificate = {
  readonly certificateId: string;
  readonly entryId: string;
  readonly certificateHash: string;
  readonly claimsAnalysis: {
    readonly claims: ReadonlyArray<{
      readonly claim: string;
      readonly status: string;
      readonly evidence: string;
    }>;
  };
  readonly evidenceChain: {
    readonly steps: ReadonlyArray<{
      readonly step: string;
      readonly reasoning: string;
    }>;
  };
  readonly confidenceAssessment: {
    readonly level: string;
    readonly score: number;
    readonly factors: ReadonlyArray<{
      readonly factor: string;
      readonly impact: string;
    }>;
    readonly rationale: string;
  };
  readonly limitations: {
    readonly items: ReadonlyArray<{
      readonly limitation: string;
      readonly severity: string;
    }>;
  };
};

export type CertificateResponse = {
  readonly certificate: ReasoningCertificate;
};

export type SubtreeResponse = {
  readonly rootEntryId: string;
  readonly entries: ReadonlyArray<ProofChainEntry>;
};

export function listChains(): Promise<ChainListResponse> {
  return request<ChainListResponse>("/chains");
}

export function listEntries(
  chainId: string,
  offset: number,
  limit: number,
  filters?: {
    readonly sessionId?: string | undefined;
    readonly modelId?: string | undefined;
    readonly actorId?: string | undefined;
    readonly startDate?: string | undefined;
    readonly endDate?: string | undefined;
  },
): Promise<EntryListResponse> {
  const params = new URLSearchParams();
  params.set("offset", String(offset));
  params.set("limit", String(limit));
  if (filters?.sessionId) params.set("sessionId", filters.sessionId);
  if (filters?.modelId) params.set("modelId", filters.modelId);
  if (filters?.actorId) params.set("actorId", filters.actorId);
  if (filters?.startDate) params.set("startDate", filters.startDate);
  if (filters?.endDate) params.set("endDate", filters.endDate);
  return request<EntryListResponse>(`/chains/${chainId}/entries?${params.toString()}`);
}

export function getEntry(chainId: string, entryId: string): Promise<EntryResponse> {
  return request<EntryResponse>(`/chains/${chainId}/entries/${entryId}`);
}

export function getSubtree(chainId: string, entryId: string): Promise<SubtreeResponse> {
  return request<SubtreeResponse>(`/chains/${chainId}/entries/${entryId}/subtree`);
}

export function getSessionEntries(
  chainId: string,
  sessionId: string,
): Promise<EntryListResponse> {
  return request<EntryListResponse>(
    `/chains/${chainId}/entries?sessionId=${encodeURIComponent(sessionId)}&limit=1000`,
  );
}

export function validateChainApi(chainId: string): Promise<ValidationResult> {
  return request<ValidationResult>(`/chains/${chainId}/validate`, { method: "POST" });
}

export function getCertificate(certificateId: string): Promise<CertificateResponse> {
  return request<CertificateResponse>(`/certificates/${certificateId}`);
}
