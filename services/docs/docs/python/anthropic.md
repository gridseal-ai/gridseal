---
sidebar_position: 2
title: Anthropic Adapter
---

# Anthropic Adapter (Python)

Wraps the Anthropic Python async SDK to auto-capture message completions into a GridSeal proof chain. Extracts only text blocks from content (tool_use blocks are ignored).

## Requirements

```bash
pip install gridseal-sdk[anthropic]
```

This installs the `anthropic` package as a dependency.

## Usage

```python
from gridseal.adapters.anthropic import wrap_anthropic
from gridseal.core import InMemoryAdapter, Ok
from anthropic import AsyncAnthropic

storage = InMemoryAdapter()

gs = wrap_anthropic(
    AsyncAnthropic(),
    chain_id="audit-chain-001",
    storage=storage,
)

result = await gs.create_message(
    messages=[{"role": "user", "content": "Explain proof chains."}],
    model="claude-sonnet-4-20250514",
    max_tokens=512,
    tags={"feature": "explainer"},
)

if isinstance(result, Ok):
    message = result.value.message  # Anthropic Message
    entry_id = result.value.entry_id
```

## API reference

### `wrap_anthropic(client, *, chain_id, storage, session_id=None, actor_id=None)`

Creates a `GridSealAnthropic` instance.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `client` | `AsyncAnthropic` | yes | An initialized async Anthropic client |
| `chain_id` | `str` | yes | Identifier for the proof chain |
| `storage` | `StorageAdapter` | yes | Storage adapter for persisting entries |
| `session_id` | `str \| None` | no | Session identifier |
| `actor_id` | `str \| None` | no | Actor identifier |

**Returns:** `GridSealAnthropic`

### `GridSealAnthropic.create_message(**kwargs)`

Makes an Anthropic messages API call and records an audit entry.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `messages` | `list[dict[str, Any]]` | required | Conversation messages |
| `model` | `str` | `"claude-sonnet-4-20250514"` | Model identifier |
| `max_tokens` | `int` | `1024` | Maximum tokens to generate |
| `decision_type` | `DecisionType \| None` | `"generation"` | Type of AI decision |
| `tags` | `dict[str, str] \| None` | `None` | Key-value metadata |
| `annotation` | `str \| None` | `None` | Human-readable note |
| `parent_entry_id` | `str \| None` | `None` | Parent entry for tree structures |

Additional keyword arguments are forwarded to the Anthropic API and included in the input hash. The `max_tokens` parameter is always included in the input hash because it is required by the Anthropic API.

**Returns:** `Result[CapturedMessage, CaptureError]`

### `GridSealAnthropic.chain` (property)

Returns the current `ChainState`.

## What gets captured

| Entry field | Source |
|------------|--------|
| `entryType` | `"ai_decision"` |
| `modelId` | `message.model` |
| `modelProvider` | `"anthropic"` |
| `inputHash` | SHA-256 of canonicalized `{"messages": ..., "model": ..., "max_tokens": ..., **kwargs}` |
| `outputHash` | SHA-256 of canonicalized concatenated text block content |
| `inputTokenCount` | `message.usage.input_tokens` |
| `outputTokenCount` | `message.usage.output_tokens` |

## Cross-language compatibility

The Python adapter produces identical hashes to the Node.js adapter for the same inputs. Canonicalization uses camelCase field names internally during hash serialization.

## Error types

| Type | When |
|------|------|
| `ANTHROPIC_API_ERROR` | The Anthropic API call raised an exception |
| `CHAIN_APPEND_ERROR` | The entry could not be appended to the proof chain |
| `STORAGE_ERROR` | The entry could not be persisted to storage |
