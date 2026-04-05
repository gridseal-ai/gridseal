---
sidebar_position: 2
title: Getting Started
---

# Getting Started

## Installation

### Node.js

```bash
# Core library
npm install @gridseal/core

# Node.js SDK (includes all adapters)
npm install @gridseal/sdk-node

# Install the AI provider SDK you need (peer dependencies)
npm install openai           # For OpenAI adapter
npm install @anthropic-ai/sdk  # For Anthropic adapter
```

### Python

```bash
# Core library
pip install gridseal-core

# SDK with OpenAI support
pip install gridseal-sdk[openai]

# SDK with Anthropic support
pip install gridseal-sdk[anthropic]
```

## Basic usage (Node.js)

### 1. Set up storage

Every GridSeal wrapper needs a storage adapter for persisting audit entries. The in-memory adapter works for development and testing:

```typescript
import { createInMemoryAdapter } from "@gridseal/core";

const storage = createInMemoryAdapter();
```

For production, use the SQLite or PostgreSQL adapters.

### 2. Wrap your AI client

```typescript
import { wrapOpenAI } from "@gridseal/sdk-node";
import OpenAI from "openai";

const gs = wrapOpenAI({
  client: new OpenAI(),
  chainId: "my-app-audit",
  storage,
  sessionId: "user-session-123",   // optional
  actorId: "user@example.com",     // optional
});
```

### 3. Make API calls

```typescript
const result = await gs.createCompletion({
  messages: [{ role: "user", content: "What is 2 + 2?" }],
  model: "gpt-4o",
  tags: { intent: "math-question" },
});

if (result.ok) {
  const { completion, entryId } = result.value;
  // completion is the standard OpenAI ChatCompletion response
  // entryId is the unique ID of the audit trail entry
}
```

### 4. Validate the chain

```typescript
import { validateChain } from "@gridseal/core";

const chain = gs.getChain();
const validation = validateChain(chain);

if (validation.ok) {
  // Chain integrity verified - no entries have been tampered with
} else {
  // validation.error describes which entry failed and why
}
```

## Basic usage (Python)

```python
from gridseal.core import InMemoryAdapter, create_chain, validate_chain
from gridseal.adapters.openai import wrap_openai
from openai import AsyncOpenAI

storage = InMemoryAdapter()
gs = wrap_openai(
    AsyncOpenAI(),
    chain_id="my-app-audit",
    storage=storage,
    session_id="user-session-123",
    actor_id="user@example.com",
)

result = await gs.create_completion(
    messages=[{"role": "user", "content": "What is 2 + 2?"}],
    model="gpt-4o",
    tags={"intent": "math-question"},
)

if isinstance(result, Ok):
    completion = result.value.completion
    entry_id = result.value.entry_id
```

## Result type

All SDK methods return a `Result<T, E>` type instead of throwing exceptions. Check `result.ok` (TypeScript) or use `isinstance(result, Ok)` / `isinstance(result, Err)` (Python) to handle success and failure cases.

```typescript
// TypeScript
const result = await gs.createCompletion({ messages: [...] });
if (result.ok) {
  // result.value contains the success data
} else {
  // result.error contains { type, message }
}
```

```python
# Python
from gridseal.core.types import Ok, Err

result = await gs.create_completion(messages=[...])
if isinstance(result, Ok):
    # result.value contains the success data
elif isinstance(result, Err):
    # result.error contains CaptureError(type=..., message=...)
```

## Error types

Every adapter returns typed errors with a `type` field indicating the failure category:

| Error type | Description |
|-----------|-------------|
| `OPENAI_API_ERROR` / `ANTHROPIC_API_ERROR` | The upstream AI API call failed |
| `HTTP_CALL_ERROR` | The HTTP call function threw an exception |
| `MCP_CALL_ERROR` | The MCP tool call function threw an exception |
| `CHAIN_APPEND_ERROR` | Failed to append the entry to the proof chain |
| `STORAGE_ERROR` | Failed to persist the entry to storage |
