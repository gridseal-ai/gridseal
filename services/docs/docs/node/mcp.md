---
sidebar_position: 5
title: MCP Interceptor
---

# MCP Interceptor (Node.js)

Intercepts MCP (Model Context Protocol) tool calls to create audit entries for every tool invocation. Records tool name, arguments, results, and error status.

The interceptor wraps a `callTool` function rather than an MCP Client object directly, providing flexibility to work with any MCP client implementation.

## Requirements

```bash
npm install @gridseal/sdk-node
```

No MCP SDK dependency required. The interceptor defines its own types matching the MCP protocol shape.

## Usage

```typescript
import { wrapMcpClient } from "@gridseal/sdk-node";
import { createInMemoryAdapter } from "@gridseal/core";

const storage = createInMemoryAdapter();

// Wrap any function that matches the MCP callTool signature
const gs = wrapMcpClient({
  callTool: mcpClient.callTool.bind(mcpClient),
  chainId: "mcp-audit",
  storage,
  modelProvider: "my-mcp-server",  // default: "mcp"
});

const result = await gs.callTool({
  name: "read_file",
  arguments: { path: "/data/report.csv" },
  tags: { workflow: "data-pipeline" },
});

if (result.ok) {
  const { result: toolResult, entryId } = result.value;
  // toolResult: { content: [...], isError?: boolean }
  // entryId: UUID of the audit entry
}
```

## API reference

### `wrapMcpClient(options)`

Creates a `GridSealMcp` interceptor.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `callTool` | `McpCallToolFn` | yes | The MCP callTool function to wrap |
| `chainId` | `string` | yes | Identifier for the proof chain |
| `storage` | `StorageAdapter` | yes | Storage adapter |
| `modelProvider` | `string` | no | Provider name (default: `"mcp"`) |
| `sessionId` | `string \| null` | no | Session identifier |
| `actorId` | `string \| null` | no | Actor identifier |

### `McpCallToolFn`

```typescript
type McpCallToolFn = (params: McpToolCallParams) => Promise<McpToolResult>;

type McpToolCallParams = {
  name: string;
  arguments?: Record<string, unknown>;
};

type McpToolResult = {
  content: McpContentBlock[];
  isError?: boolean;
};

type McpContentBlock = {
  type: string;
  text?: string;
  [key: string]: unknown;
};
```

### `GridSealMcp.callTool(options)`

Calls the wrapped MCP tool and records an audit entry.

**Parameters:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | required | Tool name |
| `arguments` | `Record<string, unknown>` | `undefined` | Tool arguments |
| `decisionType` | `DecisionType \| null` | `"tool_call"` | Decision type |
| `tags` | `Record<string, string>` | `{}` | Key-value metadata |
| `annotation` | `string \| null` | `null` | Human-readable note |
| `parentEntryId` | `string \| null` | `null` | Parent entry for tree structures |

**Returns:** `Promise<Result<CapturedToolCall, McpCaptureError>>`

### `GridSealMcp.getChain()`

Returns the current `ChainState`.

## What gets captured

| Entry field | Source |
|------------|--------|
| `entryType` | `"ai_decision"` |
| `modelId` | Tool name |
| `modelProvider` | From options (default: `"mcp"`) |
| `inputHash` | SHA-256 of canonicalized `{ name, arguments }` |
| `outputHash` | SHA-256 of canonicalized `{ content, isError }` |
| `inputTokenCount` | `null` (MCP tools do not report tokens) |
| `outputTokenCount` | `null` |
| `decisionType` | `"tool_call"` (default) |

The output hash includes both the extracted text content (only `text` type blocks) and the `isError` flag.

## Error types

| Type | When |
|------|------|
| `MCP_CALL_ERROR` | The callTool function threw an exception |
| `CHAIN_APPEND_ERROR` | The entry could not be appended |
| `STORAGE_ERROR` | The entry could not be persisted |
