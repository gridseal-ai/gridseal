---
sidebar_position: 3
title: Anthropic Tool Use Adapter
---

# Anthropic Tool Use Adapter (Node.js)

Extends the standard Anthropic adapter to capture `tool_use` content blocks as separate child entries in the proof chain. Each tool invocation gets its own audit entry linked to the parent message entry, creating a hierarchical audit trail.

## Requirements

```bash
npm install @gridseal/sdk-node @anthropic-ai/sdk
```

## Usage

```typescript
import { wrapAnthropicToolUse } from "@gridseal/sdk-node";
import { createInMemoryAdapter } from "@gridseal/core";
import Anthropic from "@anthropic-ai/sdk";

const storage = createInMemoryAdapter();

const gs = wrapAnthropicToolUse({
  client: new Anthropic(),
  chainId: "tool-audit",
  storage,
});

const result = await gs.createMessage({
  messages: [{ role: "user", content: "What is the weather in SF?" }],
  tools: [
    {
      name: "get_weather",
      description: "Get weather for a city",
      input_schema: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    },
  ],
});

if (result.ok) {
  const { message, entryId, toolUseEntries } = result.value;

  // entryId: the parent message entry
  // toolUseEntries: one entry per tool_use block in the response
  for (const tool of toolUseEntries) {
    console.log(`Tool: ${tool.toolName}, Entry: ${tool.entryId}`);
    console.log(`Input: ${JSON.stringify(tool.input)}`);
  }
}
```

## API reference

### `wrapAnthropicToolUse(options)`

Creates a `GridSealAnthropicToolUse` wrapper. Same options as the standard Anthropic adapter.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client` | `Anthropic` | yes | An initialized Anthropic client |
| `chainId` | `string` | yes | Identifier for the proof chain |
| `storage` | `StorageAdapter` | yes | Storage adapter for persisting entries |
| `sessionId` | `string \| null` | no | Session identifier |
| `actorId` | `string \| null` | no | Actor identifier |

**Returns:** `GridSealAnthropicToolUse`

### `GridSealAnthropicToolUse.createMessage(options)`

Makes an Anthropic API call and creates audit entries for the message and each tool_use block.

**Parameters:** Same as the [Anthropic adapter](./anthropic#gridsealanthropiccreatemessageoptions), plus any Anthropic `tools` parameter.

**Returns:** `Promise<Result<CapturedToolUseMessage, ToolUseCaptureError>>`

The success value includes:

```typescript
{
  message: Message;       // The Anthropic API response
  entryId: string;        // Parent message entry ID
  toolUseEntries: Array<{
    toolUseId: string;    // Anthropic's tool_use block ID
    toolName: string;     // Tool name
    input: unknown;       // Tool input arguments
    entryId: string;      // Child audit entry ID
  }>;
}
```

### `GridSealAnthropicToolUse.getChain()`

Returns the current `ChainState`.

## Chain structure

For a response with two tool_use blocks, the adapter creates three entries:

```
Entry N (parent message)
├── Entry N+1 (tool_use: get_weather)
└── Entry N+2 (tool_use: get_time)
```

### Parent entry (message)

| Entry field | Value |
|------------|-------|
| `entryType` | `"ai_decision"` |
| `modelId` | Model from API response |
| `modelProvider` | `"anthropic"` |
| `inputHash` | SHA-256 of `{ messages, model, max_tokens, ...params }` |
| `outputHash` | SHA-256 of concatenated text blocks |
| `decisionType` | From options (default: `"generation"`) |

### Child entries (tool_use)

| Entry field | Value |
|------------|-------|
| `entryType` | `"ai_decision"` |
| `modelId` | Tool name |
| `modelProvider` | `"anthropic"` |
| `parentEntryId` | ID of the parent message entry |
| `inputHash` | SHA-256 of `{ tool_use_id, name, input }` |
| `outputHash` | SHA-256 of `{ tool_use_id, name }` |
| `decisionType` | `"tool_call"` |
| `inputTokenCount` | `null` (tokens counted on parent) |
| `outputTokenCount` | `null` |
| `annotation` | `null` (independent of parent) |

## Error types

| Type | When |
|------|------|
| `ANTHROPIC_API_ERROR` | The Anthropic API call threw an exception |
| `CHAIN_APPEND_ERROR` | A message or tool_use entry could not be appended |
| `STORAGE_ERROR` | An entry could not be persisted to storage |
