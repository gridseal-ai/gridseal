---
sidebar_position: 4
title: Generic HTTP Adapter
---

# Generic HTTP Adapter (Node.js)

Wraps any HTTP-based AI API for audit capture. Unlike the OpenAI and Anthropic adapters which know their response formats, the HTTP adapter accepts user-provided extractor functions that know how to pull model IDs, content, and token counts from your API responses.

## Requirements

```bash
npm install @gridseal/sdk-node
```

No additional peer dependencies required.

## Usage

```typescript
import { wrapHttp } from "@gridseal/sdk-node";
import { createInMemoryAdapter } from "@gridseal/core";

// Define your request/response types
type MyRequest = {
  prompt: string;
  model: string;
};

type MyResponse = {
  text: string;
  model_name: string;
  usage: { input: number; output: number };
};

const storage = createInMemoryAdapter();

const gs = wrapHttp<MyRequest, MyResponse>({
  modelProvider: "my-ai-service",
  chainId: "http-audit",
  storage,
  extractors: {
    extractModelId: (res) => res.model_name,
    extractContent: (res) => res.text,
    extractInputTokens: (res) => res.usage.input,
    extractOutputTokens: (res) => res.usage.output,
  },
});

// The call function is provided per invocation
const callMyApi = async (req: MyRequest): Promise<MyResponse> => {
  const res = await fetch("https://api.my-ai.com/generate", {
    method: "POST",
    body: JSON.stringify(req),
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
};

const result = await gs.call(callMyApi, {
  request: { prompt: "Hello", model: "my-model-v2" },
  tags: { source: "api-gateway" },
});

if (result.ok) {
  const { response, entryId } = result.value;
  // response: your MyResponse object
}
```

## API reference

### `wrapHttp<TRequest, TResponse>(options)`

Creates a typed `GridSealHttp` wrapper.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `modelProvider` | `string` | yes | Provider name for audit entries |
| `chainId` | `string` | yes | Identifier for the proof chain |
| `storage` | `StorageAdapter` | yes | Storage adapter |
| `extractors` | `ResponseExtractors<TResponse>` | yes | Functions to extract data from responses |
| `sessionId` | `string \| null` | no | Session identifier |
| `actorId` | `string \| null` | no | Actor identifier |

### `ResponseExtractors<TResponse>`

| Field | Signature | Description |
|-------|-----------|-------------|
| `extractModelId` | `(response: TResponse) => string` | Extract model identifier |
| `extractContent` | `(response: TResponse) => string \| null` | Extract text content for output hashing |
| `extractInputTokens` | `(response: TResponse) => number \| null` | Extract input token count |
| `extractOutputTokens` | `(response: TResponse) => number \| null` | Extract output token count |

### `GridSealHttp.call(callFn, options)`

Makes an HTTP call using the provided function and records an audit entry.

The call function is provided per invocation rather than at wrapper creation, allowing a single wrapper to call multiple endpoints.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `callFn` | `(request: TRequest) => Promise<TResponse>` | The function that performs the HTTP call |
| `options.request` | `TRequest` | The request payload |
| `options.decisionType` | `DecisionType \| null` | Default: `"generation"` |
| `options.tags` | `Record<string, string>` | Key-value metadata |
| `options.annotation` | `string \| null` | Human-readable note |
| `options.parentEntryId` | `string \| null` | Parent entry for tree structures |

**Returns:** `Promise<Result<CapturedHttpResponse<TResponse>, HttpCaptureError>>`

### `GridSealHttp.getChain()`

Returns the current `ChainState`.

## What gets captured

| Entry field | Source |
|------------|--------|
| `entryType` | `"ai_decision"` |
| `modelId` | `extractors.extractModelId(response)` |
| `modelProvider` | From wrapper options |
| `inputHash` | SHA-256 of canonicalized request object |
| `outputHash` | SHA-256 of canonicalized extracted content |
| `inputTokenCount` | `extractors.extractInputTokens(response)` |
| `outputTokenCount` | `extractors.extractOutputTokens(response)` |

## Error types

| Type | When |
|------|------|
| `HTTP_CALL_ERROR` | The call function threw an exception |
| `CHAIN_APPEND_ERROR` | The entry could not be appended |
| `STORAGE_ERROR` | The entry could not be persisted |
