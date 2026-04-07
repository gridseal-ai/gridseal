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

## Install

```bash
pip install gridseal
```

With OpenAI adapter:

```bash
pip install gridseal[openai]
```

With Anthropic adapter:

```bash
pip install gridseal[anthropic]
```

## Usage

### Core: create a chain and append entries

```python
from gridseal.core.chain import create_chain, append_entry, validate_chain
from gridseal.core.types import AppendEntryInput

chain = create_chain("audit-chain-001")

result = append_entry(chain, AppendEntryInput(
    entry_type="ai_decision",
    model_id="gpt-4o",
    model_provider="openai",
    decision_type="classification",
    input_hash="a1b2c3...",
    output_hash="d4e5f6...",
    actor_id="analyst-chen",
    session_id="session-001",
))

if result.ok:
    print(f"Entry appended: {result.value.entry_id}")

# Verify the entire chain is intact
validation = validate_chain(chain)
print(f"Chain valid: {validation.ok}")
```

### Wrap OpenAI calls (auto-capture)

```python
from gridseal.adapters.openai import wrap_openai
from gridseal.core.chain import create_chain
from gridseal.core.storage import InMemoryStorage
from openai import AsyncOpenAI

storage = InMemoryStorage()
chain = create_chain("my-chain")

client = wrap_openai(
    client=AsyncOpenAI(),
    storage=storage,
    chain=chain,
)

# Every call is now automatically audited
result = await client.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Approve this loan?"}],
)
# result.entry contains the proof chain entry
# result.completion contains the OpenAI response
```

## What it does

- Hash-chained entries with SHA-256, append-only, tamper-evident
- Chain validation (full chain, subtree, single entry)
- SDK wrappers for OpenAI and Anthropic with auto-capture
- LangGraph and CrewAI framework adapters
- In-memory storage adapter included
- Python 3.12+, type hints throughout, async-first

## License

AGPL-3.0-only
