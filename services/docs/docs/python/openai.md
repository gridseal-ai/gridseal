---
sidebar_position: 1
title: OpenAI Adapter
---

# OpenAI Adapter (Python)

Wraps the OpenAI Python async SDK to auto-capture chat completions into a GridSeal proof chain.

## Requirements

```bash
pip install gridseal-sdk[openai]
```

This installs the `openai` package as a dependency.

## Usage

```python
from gridseal.adapters.openai import wrap_openai
from gridseal.core import InMemoryAdapter, Ok
from openai import AsyncOpenAI

storage = InMemoryAdapter()

gs = wrap_openai(
    AsyncOpenAI(),
    chain_id="audit-chain-001",
    storage=storage,
    session_id="session-abc",
    actor_id="user@example.com",
)

result = await gs.create_completion(
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain hash chains in one sentence."},
    ],
    model="gpt-4o",
    decision_type="generation",
    tags={"workflow": "explainer"},
    annotation="User asked about hash chains",
)

if isinstance(result, Ok):
    completion = result.value.completion  # OpenAI ChatCompletion
    entry_id = result.value.entry_id     # UUID of audit entry
else:
    error = result.error  # CaptureError(type=..., message=...)
```

## API reference

### `wrap_openai(client, *, chain_id, storage, session_id=None, actor_id=None)`

Creates a `GridSealOpenAI` instance.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `client` | `AsyncOpenAI` | yes | An initialized async OpenAI client |
| `chain_id` | `str` | yes | Identifier for the proof chain |
| `storage` | `StorageAdapter` | yes | Storage adapter for persisting entries |
| `session_id` | `str \| None` | no | Session identifier |
| `actor_id` | `str \| None` | no | Actor identifier |

**Returns:** `GridSealOpenAI`

### `GridSealOpenAI.create_completion(**kwargs)`

Makes an OpenAI chat completion call and records an audit entry.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `messages` | `list[dict[str, Any]]` | required | Chat messages |
| `model` | `str` | `"gpt-4o"` | Model identifier |
| `decision_type` | `DecisionType \| None` | `"generation"` | Type of AI decision |
| `tags` | `dict[str, str] \| None` | `None` | Key-value metadata |
| `annotation` | `str \| None` | `None` | Human-readable note |
| `parent_entry_id` | `str \| None` | `None` | Parent entry for tree structures |

Additional keyword arguments are forwarded to the OpenAI API and included in the input hash.

**Returns:** `Result[CapturedCompletion, CaptureError]`

### `GridSealOpenAI.chain` (property)

Returns the current `ChainState`.

## What gets captured

| Entry field | Source |
|------------|--------|
| `entryType` | `"ai_decision"` |
| `modelId` | `completion.model` |
| `modelProvider` | `"openai"` |
| `inputHash` | SHA-256 of canonicalized `{"messages": ..., "model": ..., **kwargs}` |
| `outputHash` | SHA-256 of canonicalized first choice content |
| `inputTokenCount` | `completion.usage.prompt_tokens` |
| `outputTokenCount` | `completion.usage.completion_tokens` |

## Cross-language compatibility

The Python adapter produces identical hashes to the Node.js adapter for the same inputs. This is achieved through shared canonicalization logic that uses camelCase field names during hash serialization.

## Error types

| Type | When |
|------|------|
| `OPENAI_API_ERROR` | The OpenAI API call raised an exception |
| `CHAIN_APPEND_ERROR` | The entry could not be appended to the proof chain |
| `STORAGE_ERROR` | The entry could not be persisted to storage |
