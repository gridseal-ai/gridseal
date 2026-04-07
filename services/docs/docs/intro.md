---
slug: /
sidebar_position: 1
title: Introduction
---

# GridSeal SDK

GridSeal produces tamper-evident, cryptographically verifiable audit trails for AI decisions. Every AI call your application makes - whether through OpenAI, Anthropic, or any HTTP-based API - gets recorded as a hash-chained, append-only proof chain entry.

## What it does

- **Hash-chained audit log**: Every AI decision is recorded with SHA-256 hashes linking each entry to its predecessor, making tampering detectable.
- **Auto-capture**: SDK wrappers intercept AI API calls and record inputs, outputs, model metadata, and token counts without changing your application logic.
- **Cross-language**: TypeScript/Node.js and Python SDKs produce identical hashes for the same inputs, enabling cross-language verification.
- **Compliance-ready**: Proof chain entries include 24 fields across 3 tiers, covering chain integrity, AI decision context, and compliance metadata.

## Packages

| Package | Language | Description |
|---------|----------|-------------|
| `@gridseal/core` | TypeScript | Core library: hash chain, entry types, validation, storage |
| `@gridseal/sdk-node` | TypeScript | Node.js SDK with adapters for OpenAI, Anthropic, HTTP, MCP |
| `gridseal-core` | Python | Core types and hashing (cross-compatible with TypeScript) |
| `gridseal-sdk` | Python | Python SDK with adapters for OpenAI, Anthropic |

## Quick example

```typescript
import { wrapOpenAI } from "@gridseal/sdk-node";
import { createInMemoryAdapter } from "@gridseal/core";
import OpenAI from "openai";

const storage = createInMemoryAdapter();
const gs = wrapOpenAI({
  client: new OpenAI(),
  chainId: "my-app-audit",
  storage,
});

const result = await gs.createCompletion({
  messages: [{ role: "user", content: "Summarize this document" }],
  model: "gpt-4o",
  tags: { workflow: "document-processing" },
});

if (result.ok) {
  console.log(result.value.completion.choices[0].message.content);
  console.log("Audit entry:", result.value.entryId);
}
```

Every call is automatically recorded in the proof chain with cryptographic hashes of the input and output, token counts, model ID, and timestamps.
