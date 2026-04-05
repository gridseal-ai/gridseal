---
sidebar_position: 3
title: Core Concepts
---

# Core Concepts

## Proof chain

A proof chain is an append-only, hash-linked sequence of entries. Each entry's hash is computed from its own fields plus the hash of the previous entry, creating a tamper-evident chain: modifying any entry invalidates all subsequent hashes.

```
Entry 0          Entry 1          Entry 2
┌──────────┐     ┌──────────┐     ┌──────────┐
│ hash: H0 │◄────│ prev: H0 │◄────│ prev: H1 │
│ prev: ∅  │     │ hash: H1 │     │ hash: H2 │
│ data...  │     │ data...  │     │ data...  │
└──────────┘     └──────────┘     └──────────┘
```

Chains also support tree structures via `parentEntryId`, allowing you to model hierarchical decisions (e.g., an AI message that triggers multiple tool calls).

## Entry fields (3 tiers)

Every proof chain entry has 24 fields organized into 3 tiers:

### Tier 1: Chain integrity (8 fields)

These fields establish the cryptographic chain and are always present.

| Field | Type | Description |
|-------|------|-------------|
| `entryId` | string | Unique identifier (UUID) |
| `chainId` | string | ID of the chain this entry belongs to |
| `sequenceNumber` | number | Zero-based position in the chain |
| `timestamp` | string | ISO 8601 timestamp |
| `entryType` | string | One of: `ai_decision`, `human_override`, `system_event`, `policy_check`, `data_access`, `model_deployment`, `feedback`, `correction` |
| `entryHash` | string | SHA-256 hash of this entry (computed from all other hashable fields) |
| `previousHash` | string or null | Hash of the previous entry (null for first entry) |
| `parentEntryId` | string or null | ID of parent entry for tree structures |

### Tier 2: AI decision context (10 fields)

These fields capture AI-specific metadata. All are nullable for non-AI entry types.

| Field | Type | Description |
|-------|------|-------------|
| `modelId` | string or null | Model identifier (e.g., `gpt-4o`, `claude-sonnet-4-20250514`) |
| `modelProvider` | string or null | Provider name (e.g., `openai`, `anthropic`) |
| `inputHash` | string or null | SHA-256 hash of the canonicalized input |
| `outputHash` | string or null | SHA-256 hash of the canonicalized output |
| `inputTokenCount` | number or null | Input tokens consumed |
| `outputTokenCount` | number or null | Output tokens generated |
| `decisionType` | string or null | One of: `classification`, `generation`, `recommendation`, `extraction`, `summarization`, `translation`, `embedding`, `tool_call`, `routing`, `other` |
| `confidenceScore` | number or null | Confidence between 0 and 1 |
| `reasoningCertificateId` | string or null | Link to a reasoning certificate |
| `provenanceId` | string or null | Link to model provenance record |

### Tier 3: Compliance and metadata (6 fields)

These fields support regulatory compliance and operational tracking.

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string or null | Session identifier |
| `actorId` | string or null | Who triggered the action |
| `policyIds` | string[] | Policy IDs this entry was checked against |
| `tags` | Record | Key-value metadata pairs |
| `annotation` | string or null | Human-readable note |
| `complianceMetadata` | Record | Regulatory metadata (e.g., jurisdiction, regulation) |

## Hashing

GridSeal uses SHA-256 exclusively (Node.js `crypto.createHash('sha256')`, Python `hashlib.sha256()`).

Before hashing, values are **canonicalized**: JSON-serialized with sorted keys, no extra whitespace, and UTF-8 encoding. This deterministic serialization ensures that the same logical input always produces the same hash, regardless of programming language or object key ordering.

The entry hash is computed over a fixed sequence of 23 fields (all fields except `entryHash` itself). Field order is locked and identical across TypeScript and Python.

## Validation

Chain validation walks every entry in sequence and verifies:

1. Each entry's `entryHash` matches the recomputed hash of its fields.
2. Each entry's `previousHash` matches the `entryHash` of the preceding entry.
3. Sequence numbers are consecutive starting from 0.
4. All entries share the same `chainId`.

If any check fails, validation returns the exact position and reason for the failure.

You can also validate subtrees (entries rooted at a specific parent) or individual entries.

## Storage adapters

Storage adapters persist and retrieve proof chain entries. GridSeal ships with:

- **In-memory adapter**: For testing and development. Data is lost when the process exits.
- **SQLite adapter**: For local/single-process deployments. Entries stored in individual columns with certificates and provenance as JSON.
- **PostgreSQL adapter**: For production multi-process deployments.

All adapters implement the same `StorageAdapter` interface (TypeScript) / `StorageAdapter` protocol (Python), so switching between them requires no code changes beyond initialization.

## Result type

Library functions return `Result<T, E>` instead of throwing exceptions:

```typescript
// TypeScript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

```python
# Python
Result[T, E] = Ok[T] | Err[E]
```

This makes error handling explicit and avoids the need for try/catch blocks around every SDK call.
