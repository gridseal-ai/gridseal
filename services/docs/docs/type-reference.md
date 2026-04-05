---
sidebar_position: 10
title: Type Reference
---

# Type Reference

## Core types

### ProofChainEntry

The 24-field entry stored in the proof chain. All fields are readonly.

```typescript
type ProofChainEntry = {
  // Tier 1: Chain integrity
  entryId: string;
  chainId: string;
  sequenceNumber: number;
  timestamp: string;
  entryType: EntryType;
  entryHash: string;
  previousHash: string | null;
  parentEntryId: string | null;

  // Tier 2: AI decision context
  modelId: string | null;
  modelProvider: string | null;
  inputHash: string | null;
  outputHash: string | null;
  inputTokenCount: number | null;
  outputTokenCount: number | null;
  decisionType: DecisionType | null;
  confidenceScore: number | null;
  reasoningCertificateId: string | null;
  provenanceId: string | null;

  // Tier 3: Compliance and metadata
  sessionId: string | null;
  actorId: string | null;
  policyIds: readonly string[];
  tags: Record<string, string>;
  annotation: string | null;
  complianceMetadata: Record<string, unknown>;
};
```

### EntryType

```typescript
type EntryType =
  | "ai_decision"
  | "human_override"
  | "system_event"
  | "policy_check"
  | "data_access"
  | "model_deployment"
  | "feedback"
  | "correction";
```

### DecisionType

```typescript
type DecisionType =
  | "classification"
  | "generation"
  | "recommendation"
  | "extraction"
  | "summarization"
  | "translation"
  | "embedding"
  | "tool_call"
  | "routing"
  | "other";
```

### Result

```typescript
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

### ChainState

```typescript
type ChainState = {
  chainId: string;
  entries: readonly ProofChainEntry[];
};
```

### AppendEntryInput

Fields required to create a new entry (excludes computed fields like `entryHash`, `sequenceNumber`, `previousHash`).

```typescript
type AppendEntryInput = {
  entryId: string;
  timestamp: string;
  entryType: EntryType;
  parentEntryId?: string | null;
  modelId?: string | null;
  modelProvider?: string | null;
  inputHash?: string | null;
  outputHash?: string | null;
  inputTokenCount?: number | null;
  outputTokenCount?: number | null;
  decisionType?: DecisionType | null;
  confidenceScore?: number | null;
  reasoningCertificateId?: string | null;
  provenanceId?: string | null;
  sessionId?: string | null;
  actorId?: string | null;
  policyIds?: readonly string[];
  tags?: Record<string, string>;
  annotation?: string | null;
  complianceMetadata?: Record<string, unknown>;
};
```

### StorageAdapter

```typescript
type StorageAdapter = {
  putEntry(entry: ProofChainEntry): Promise<Result<ProofChainEntry, StorageError>>;
  getEntry(entryId: string): Promise<Result<ProofChainEntry, StorageError>>;
  getEntriesByChainId(chainId: string): Promise<ProofChainEntry[]>;
  getEntriesBySequenceRange(
    chainId: string,
    start: number,
    end: number
  ): Promise<ProofChainEntry[]>;
  getEntriesByParentId(parentEntryId: string): Promise<ProofChainEntry[]>;
  putCertificate(cert: ReasoningCertificate): Promise<Result<ReasoningCertificate, StorageError>>;
  getCertificate(id: string): Promise<Result<ReasoningCertificate, StorageError>>;
  putProvenance(prov: ModelProvenance): Promise<Result<ModelProvenance, StorageError>>;
  getProvenance(id: string): Promise<Result<ModelProvenance, StorageError>>;
  getChainLength(chainId: string): Promise<number>;
  listChainIds(): Promise<string[]>;
  clear(): Promise<void>;
};
```

## Node.js SDK types

### OpenAI adapter

```typescript
type GridSealOpenAI = {
  createCompletion(options: CreateCompletionOptions): Promise<Result<CapturedCompletion, CaptureError>>;
  getChain(): ChainState;
};

type CapturedCompletion = {
  completion: ChatCompletion;
  entryId: string;
};

type CaptureError = {
  type: "OPENAI_API_ERROR" | "CHAIN_APPEND_ERROR" | "STORAGE_ERROR";
  message: string;
};
```

### Anthropic adapter

```typescript
type GridSealAnthropic = {
  createMessage(options: CreateMessageOptions): Promise<Result<CapturedMessage, CaptureError>>;
  getChain(): ChainState;
};

type CapturedMessage = {
  message: Message;
  entryId: string;
};
```

### Anthropic Tool Use adapter

```typescript
type GridSealAnthropicToolUse = {
  createMessage(options: CreateToolUseMessageOptions): Promise<Result<CapturedToolUseMessage, ToolUseCaptureError>>;
  getChain(): ChainState;
};

type CapturedToolUseMessage = {
  message: Message;
  entryId: string;
  toolUseEntries: readonly CapturedToolUse[];
};

type CapturedToolUse = {
  toolUseId: string;
  toolName: string;
  input: unknown;
  entryId: string;
};

type ToolUseCaptureError = {
  type: "ANTHROPIC_API_ERROR" | "CHAIN_APPEND_ERROR" | "STORAGE_ERROR";
  message: string;
};
```

### HTTP adapter

```typescript
type GridSealHttp<TRequest, TResponse> = {
  call(
    callFn: HttpCallFn<TRequest, TResponse>,
    options: HttpCallOptions<TRequest>
  ): Promise<Result<CapturedHttpResponse<TResponse>, HttpCaptureError>>;
  getChain(): ChainState;
};

type ResponseExtractors<TResponse> = {
  extractModelId: (response: TResponse) => string;
  extractContent: (response: TResponse) => string | null;
  extractInputTokens: (response: TResponse) => number | null;
  extractOutputTokens: (response: TResponse) => number | null;
};

type HttpCallFn<TRequest, TResponse> = (request: TRequest) => Promise<TResponse>;

type CapturedHttpResponse<TResponse> = {
  response: TResponse;
  entryId: string;
};

type HttpCaptureError = {
  type: "HTTP_CALL_ERROR" | "CHAIN_APPEND_ERROR" | "STORAGE_ERROR";
  message: string;
};
```

### MCP interceptor

```typescript
type GridSealMcp = {
  callTool(options: InterceptCallOptions): Promise<Result<CapturedToolCall, McpCaptureError>>;
  getChain(): ChainState;
};

type McpCallToolFn = (params: McpToolCallParams) => Promise<McpToolResult>;

type McpToolCallParams = {
  name: string;
  arguments?: Record<string, unknown>;
};

type McpToolResult = {
  content: McpContentBlock[];
  isError?: boolean;
};

type CapturedToolCall = {
  result: McpToolResult;
  entryId: string;
};

type McpCaptureError = {
  type: "MCP_CALL_ERROR" | "CHAIN_APPEND_ERROR" | "STORAGE_ERROR";
  message: string;
};
```

## Python SDK types

### Core types

```python
@dataclass(frozen=True, slots=True)
class ProofChainEntry:
    entry_id: str
    chain_id: str
    sequence_number: int
    timestamp: str
    entry_type: EntryType
    entry_hash: str
    previous_hash: str | None
    parent_entry_id: str | None
    model_id: str | None
    model_provider: str | None
    input_hash: str | None
    output_hash: str | None
    input_token_count: int | None
    output_token_count: int | None
    decision_type: DecisionType | None
    confidence_score: float | None
    reasoning_certificate_id: str | None
    provenance_id: str | None
    session_id: str | None
    actor_id: str | None
    policy_ids: tuple[str, ...]
    tags: dict[str, str]
    annotation: str | None
    compliance_metadata: dict[str, Any]

EntryType = Literal[
    "ai_decision", "human_override", "system_event",
    "policy_check", "data_access", "model_deployment",
    "feedback", "correction"
]

DecisionType = Literal[
    "classification", "generation", "recommendation",
    "extraction", "summarization", "translation",
    "embedding", "tool_call", "routing", "other"
]

Result[T, E] = Ok[T] | Err[E]
```

### OpenAI adapter

```python
@dataclass(frozen=True, slots=True)
class CapturedCompletion:
    completion: ChatCompletion
    entry_id: str

@dataclass(frozen=True, slots=True)
class CaptureError:
    type: str  # "OPENAI_API_ERROR" | "CHAIN_APPEND_ERROR" | "STORAGE_ERROR"
    message: str
```

### Anthropic adapter

```python
@dataclass(frozen=True, slots=True)
class CapturedMessage:
    message: Message
    entry_id: str
```
