---
sidebar_position: 1
title: OpenAI Adapter
---

# OpenAI Adapter (Node.js)

Wraps the OpenAI Node.js SDK to auto-capture chat completions into a GridSeal proof chain.

## Requirements

```bash
npm install @gridseal/sdk-node openai
```

The `openai` package is a peer dependency.

## Usage

```typescript
import { wrapOpenAI } from "@gridseal/sdk-node";
import { createInMemoryAdapter } from "@gridseal/core";
import OpenAI from "openai";

const storage = createInMemoryAdapter();

const gs = wrapOpenAI({
  client: new OpenAI(),
  chainId: "audit-chain-001",
  storage,
  sessionId: "session-abc",  // optional
  actorId: "user@example.com",  // optional
});

const result = await gs.createCompletion({
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Explain hash chains in one sentence." },
  ],
  model: "gpt-4o",
  decisionType: "generation",
  tags: { workflow: "explainer" },
  annotation: "User asked about hash chains",
});

if (result.ok) {
  const { completion, entryId } = result.value;
  // completion: standard OpenAI ChatCompletion object
  // entryId: UUID of the audit entry
} else {
  // result.error: { type, message }
}
```

## API reference

### `wrapOpenAI(options)`

Creates a `GridSealOpenAI` wrapper around an OpenAI client.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client` | `OpenAI` | yes | An initialized OpenAI client instance |
| `chainId` | `string` | yes | Identifier for the proof chain |
| `storage` | `StorageAdapter` | yes | Storage adapter for persisting entries |
| `sessionId` | `string \| null` | no | Session identifier for all entries |
| `actorId` | `string \| null` | no | Actor identifier for all entries |

**Returns:** `GridSealOpenAI`

### `GridSealOpenAI.createCompletion(options)`

Makes an OpenAI chat completion call and records an audit entry.

**Parameters:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `messages` | `ChatCompletionMessage[]` | required | Chat messages array |
| `model` | `string` | `"gpt-4o"` | Model identifier |
| `decisionType` | `DecisionType \| null` | `"generation"` | Type of AI decision |
| `tags` | `Record<string, string>` | `{}` | Key-value metadata |
| `annotation` | `string \| null` | `null` | Human-readable note |
| `parentEntryId` | `string \| null` | `null` | Parent entry for tree structures |

Any additional properties from OpenAI's `ChatCompletionCreateParamsNonStreaming` (e.g., `temperature`, `max_tokens`, `top_p`) are forwarded to the API call and included in the input hash.

**Returns:** `Promise<Result<CapturedCompletion, CaptureError>>`

### `GridSealOpenAI.getChain()`

Returns the current `ChainState`, useful for validation.

## What gets captured

Each call creates one proof chain entry with:

| Entry field | Source |
|------------|--------|
| `entryType` | `"ai_decision"` |
| `modelId` | `completion.model` (from API response) |
| `modelProvider` | `"openai"` |
| `inputHash` | SHA-256 of canonicalized `{ messages, model, ...extraParams }` |
| `outputHash` | SHA-256 of canonicalized first choice content |
| `inputTokenCount` | `completion.usage.prompt_tokens` |
| `outputTokenCount` | `completion.usage.completion_tokens` |
| `decisionType` | From call options |

## Error types

| Type | When |
|------|------|
| `OPENAI_API_ERROR` | The OpenAI API call threw an exception |
| `CHAIN_APPEND_ERROR` | The entry could not be appended to the proof chain |
| `STORAGE_ERROR` | The entry could not be persisted to storage |
