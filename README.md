# GridSeal

Tamper-evident, cryptographically verifiable audit trail for AI decisions. Hash-chained, append-only logs of AI system inputs, outputs, reasoning, and metadata.

## Install

```bash
npm install @gridseal/core
```

## Usage

```typescript
import { createChain, appendEntry } from '@gridseal/core';

const chain = createChain();
const entry = appendEntry(chain, {
  modelId: 'gpt-4',
  inputHash: '...',
  outputHash: '...',
  decision: 'loan-approved',
});
```

## License

AGPL-3.0-only
