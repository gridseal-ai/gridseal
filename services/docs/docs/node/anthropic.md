---
sidebar_position: 2
title: Anthropic Adapter
---

# Anthropic Adapter (Node.js)

Wraps the Anthropic Node.js SDK to auto-capture message completions into a GridSeal proof chain. Extracts only text blocks from content (tool_use blocks are ignored; see the [Tool Use adapter](./anthropic-tool-use) for capturing those).

## Requirements

```bash
npm install @gridseal/sdk-node @anthropic-ai/sdk
```

The `@anthropic-ai/sdk` package is a peer dependency.

## Usage

```typescript
import { wrapAnthropic } from "@gridseal/sdk-node";
import { createInMemoryAdapter } from "@gridseal/core";
import Anthropic from "@anthropic-ai/sdk";

const storage = createInMemoryAdapter();

const gs = wrapAnthropic({
  client: new Anthropic(),
  chainId: "audit-chain-001",
  storage,
});

const result = await gs.createMessage({
  messages: [{ role: "user", content: "Explain proof chains." }],
  model: "claude-sonnet-4-20250514",
  maxTokens: 512,
  tags: { feature: "explainer" },
});

if (result.ok) {
  const { message, entryId } = result.value;
  // message: standard Anthropic Message object
  // entryId: UUID of the audit entry
}
```

## API reference

### `wrapAnthropic(options)`

Creates a `GridSealAnthropic` wrapper around an Anthropic client.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client` | `Anthropic` | yes | An initialized Anthropic client instance |
| `chainId` | `string` | yes | Identifier for the proof chain |
| `storage` | `StorageAdapter` | yes | Storage adapter for persisting entries |
| `sessionId` | `string \| null` | no | Session identifier for all entries |
| `actorId` | `string \| null` | no | Actor identifier for all entries |

**Returns:** `GridSealAnthropic`

### `GridSealAnthropic.createMessage(options)`

Makes an Anthropic messages API call and records an audit entry.

**Parameters:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `messages` | `MessageParam[]` | required | Conversation messages |
| `model` | `string` | `"claude-sonnet-4-20250514"` | Model identifier |
| `maxTokens` | `number` | `1024` | Maximum tokens to generate |
| `decisionType` | `DecisionType \| null` | `"generation"` | Type of AI decision |
| `tags` | `Record<string, string>` | `{}` | Key-value metadata |
| `annotation` | `string \| null` | `null` | Human-readable note |
| `parentEntryId` | `string \| null` | `null` | Parent entry for tree structures |

Additional Anthropic parameters (e.g., `temperature`, `top_p`, `system`) are forwarded to the API and included in the input hash. The `maxTokens` option maps to the Anthropic API's `max_tokens` parameter.

**Returns:** `Promise<Result<CapturedMessage, CaptureError>>`

### `GridSealAnthropic.getChain()`

Returns the current `ChainState`.

## What gets captured

| Entry field | Source |
|------------|--------|
| `entryType` | `"ai_decision"` |
| `modelId` | `message.model` (from API response) |
| `modelProvider` | `"anthropic"` |
| `inputHash` | SHA-256 of canonicalized `{ messages, model, max_tokens, ...extraParams }` |
| `outputHash` | SHA-256 of canonicalized concatenated text block content |
| `inputTokenCount` | `message.usage.input_tokens` |
| `outputTokenCount` | `message.usage.output_tokens` |

The input hash includes `max_tokens` because it is a required parameter for the Anthropic API and affects output behavior.

## Error types

| Type | When |
|------|------|
| `ANTHROPIC_API_ERROR` | The Anthropic API call threw an exception |
| `CHAIN_APPEND_ERROR` | The entry could not be appended to the proof chain |
| `STORAGE_ERROR` | The entry could not be persisted to storage |
