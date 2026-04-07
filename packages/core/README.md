# GridSeal

Tamper-evident, cryptographically verifiable audit trail for AI systems.

## Why

AI systems make decisions that affect people, from loan approvals to medical
recommendations to government benefits. Regulations are arriving: the EU AI Act
(Article 12 record-keeping, August 2026), Colorado SB-205, NIST AI RMF, and
HIPAA audit controls. Organizations need proof of what their AI did, why it did
it, and whether a human reviewed it. GridSeal provides that proof as a
SHA-256 hash-chained, append-only log that is cryptographically verifiable and
impossible to silently tamper with.

## Who this is for

Government agencies deploying AI for public services need audit trails for
accountability and FOIA compliance. Financial services using AI for lending and
fraud detection need records for fair lending laws and examiner reviews.
Healthcare organizations using AI for diagnostics need HIPAA audit controls.
Any company shipping AI products in the EU after August 2026 needs Article 12
record-keeping. Platform companies building multi-agent systems need provenance
tracking across agent delegation chains.

## What it does

- **Hash-chained entries** - 24-field proof chain entries (3 tiers: core
  integrity, AI decision context, compliance metadata) linked by SHA-256 hashes
- **Chain validation** - verify full chains, subtrees, or single entries;
  detects tampering at the exact position
- **Reasoning certificates** - structured records of AI reasoning: premises,
  trace steps, conclusions, confidence assessments, unsupported claims
- **Compliance auto-tagging** - automatic mapping of entries to regulatory
  requirements (Colorado SB-205, EU AI Act, NIST AI RMF, HIPAA)
- **Model provenance** - AIBOM records compatible with CycloneDX ML-BOM,
  tracking model identity, training data, and performance metrics
- **Storage adapters** - in-memory and SQLite adapters included, with a
  pluggable adapter interface
- **SDK wrappers** - drop-in wrappers for OpenAI, Anthropic, generic HTTP,
  MCP tool calls, LangGraph, and CrewAI that auto-capture audit entries
- **Compliance reports** - generate regulation-specific reports with gap
  analysis from chain data

## Install

```bash
npm install @gridseal/core
```

For SDK wrappers that auto-capture AI provider calls:

```bash
npm install @gridseal/sdk-node
```

## Usage

### Core: create a chain and append entries

```typescript
import {
  createChain,
  appendEntry,
  validateChain,
} from "@gridseal/core";

const chain = createChain("audit-chain-001");

const result = appendEntry(chain, {
  entryId: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  entryType: "model-inference",
  modelId: "gpt-4o",
  inputHash: "a1b2c3...",
  outputHash: "d4e5f6...",
  decisionType: "classification",
});

if (result.ok) {
  const { chain: updated, entry } = result.value;
  console.log(entry.entryHash); // SHA-256 hash of the entry
  console.log(entry.previousHash); // links to prior entry

  // Validate the entire chain
  const valid = validateChain(updated);
  if (!valid.ok) {
    console.error(valid.error); // reports exact position of tampering
  }
}
```

### SDK: wrap an OpenAI client

```typescript
import { wrapOpenAI } from "@gridseal/sdk-node";
import { createInMemoryAdapter } from "@gridseal/core";
import OpenAI from "openai";

const gridseal = wrapOpenAI({
  client: new OpenAI(),
  chainId: "session-001",
  storage: createInMemoryAdapter(),
});

const result = await gridseal.createCompletion({
  messages: [{ role: "user", content: "Evaluate this loan application." }],
  model: "gpt-4o",
  decisionType: "approval-denial",
});

if (result.ok) {
  const { completion, entryId } = result.value;
  // completion: standard OpenAI ChatCompletion
  // entryId: ID of the audit entry in the proof chain
}
```

## Requirements

Node.js >= 22. Uses native `crypto` module for SHA-256 hashing, no third-party
crypto dependencies.

## License

AGPL-3.0-only
