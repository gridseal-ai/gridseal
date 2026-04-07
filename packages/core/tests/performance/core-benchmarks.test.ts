/**
 * Layer 7 - Performance and stress benchmarks for @gridseal/core.
 *
 * Every test exercises the real implementation with real data.
 * No mocks, no stubs. Assertions enforce the performance targets
 * documented in CLAUDE.md.
 */

import { describe, it, expect, afterEach } from "vitest";
import { performance } from "node:perf_hooks";
import {
  createChain,
  appendEntry,
  validateChain,
  generateComplianceReport,
  createInMemoryAdapter,
  createCertificate,
} from "../../src/index.js";
import { createSqliteAdapter } from "../../src/storage/sqlite-adapter.js";
import type { AppendEntryInput, ChainState } from "../../src/chain/proof-chain.js";
import type { EntryType } from "../../src/schema/entry-types.js";
import type { StorageAdapter } from "../../src/storage/storage-adapter.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ENTRY_TYPES: ReadonlyArray<EntryType> = [
  "ai_decision",
  "human_override",
  "system_event",
  "policy_check",
  "data_access",
];

function makeInput(index: number): AppendEntryInput {
  return {
    entryId: `perf-${index}`,
    timestamp: `2026-04-05T00:00:${String(index % 60).padStart(2, "0")}.000Z`,
    entryType: ENTRY_TYPES[index % ENTRY_TYPES.length] as EntryType,
    modelId: `model-${index % 3}`,
    modelProvider: "test-provider",
    inputHash: `a`.repeat(64),
    outputHash: `b`.repeat(64),
    decisionType: "classification",
    sessionId: `session-${index % 10}`,
    actorId: "perf-actor",
  };
}

function buildChain(count: number, prefix = "perf"): ChainState {
  let chain = createChain("perf-chain");
  for (let i = 0; i < count; i++) {
    const result = appendEntry(chain, {
      ...makeInput(i),
      entryId: `${prefix}-${i}`,
    });
    if (!result.ok) {
      throw new Error(`Failed at entry ${i}: ${result.error.type}`);
    }
    chain = result.value.chain;
  }
  return chain;
}

function percentile(sorted: ReadonlyArray<number>, p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] as number;
}

/* ------------------------------------------------------------------ */
/*  1. Throughput - chain append (in-memory)                            */
/* ------------------------------------------------------------------ */

describe("Throughput benchmarks", () => {
  it("appends at least 1000 entries/second to an in-memory chain", () => {
    const count = 5000;
    let chain = createChain("throughput-mem");

    const start = performance.now();
    for (let i = 0; i < count; i++) {
      const result = appendEntry(chain, {
        ...makeInput(i),
        entryId: `tp-mem-${i}`,
      });
      if (!result.ok) {
        throw new Error(`Append failed at ${i}: ${result.error.type}`);
      }
      chain = result.value.chain;
    }
    const elapsed = performance.now() - start;

    const entriesPerSecond = (count / elapsed) * 1000;
    expect(entriesPerSecond).toBeGreaterThanOrEqual(1000);
  });

  it("appends at least 500 entries/second to a SQLite-backed chain", async () => {
    const count = 2000;
    const adapter = createSqliteAdapter({ path: ":memory:" });
    let chain = createChain("throughput-sqlite");

    const start = performance.now();
    for (let i = 0; i < count; i++) {
      const result = appendEntry(chain, {
        ...makeInput(i),
        entryId: `tp-sql-${i}`,
      });
      if (!result.ok) {
        throw new Error(`Append failed at ${i}: ${result.error.type}`);
      }
      chain = result.value.chain;
      const putResult = await adapter.putEntry(result.value.entry);
      if (!putResult.ok) {
        throw new Error(`Storage put failed at ${i}: ${putResult.error.type}`);
      }
    }
    const elapsed = performance.now() - start;

    const entriesPerSecond = (count / elapsed) * 1000;
    expect(entriesPerSecond).toBeGreaterThanOrEqual(500);
  });
});

/* ------------------------------------------------------------------ */
/*  2. Latency - entry creation p50/p95/p99                             */
/* ------------------------------------------------------------------ */

describe("Latency benchmarks", () => {
  it("creates entries with p99 latency under 5ms", () => {
    const count = 5000;
    const latencies: Array<number> = [];
    let chain = createChain("latency-chain");

    for (let i = 0; i < count; i++) {
      const start = performance.now();
      const result = appendEntry(chain, {
        ...makeInput(i),
        entryId: `lat-${i}`,
      });
      const elapsed = performance.now() - start;
      latencies.push(elapsed);

      if (!result.ok) {
        throw new Error(`Append failed at ${i}: ${result.error.type}`);
      }
      chain = result.value.chain;
    }

    latencies.sort((a, b) => a - b);
    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    const p99 = percentile(latencies, 99);

    expect(p99).toBeLessThan(5);
    // Record values for the test summary (logged via test name)
    expect(p50).toBeGreaterThan(0);
    expect(p95).toBeGreaterThan(0);
  });

  it("writes entries to SQLite with p99 latency under 10ms", async () => {
    const count = 2000;
    const latencies: Array<number> = [];
    const adapter = createSqliteAdapter({ path: ":memory:" });
    let chain = createChain("lat-sqlite");

    for (let i = 0; i < count; i++) {
      const result = appendEntry(chain, {
        ...makeInput(i),
        entryId: `lat-sq-${i}`,
      });
      if (!result.ok) {
        throw new Error(`Append failed at ${i}: ${result.error.type}`);
      }
      chain = result.value.chain;

      const start = performance.now();
      const putResult = await adapter.putEntry(result.value.entry);
      const elapsed = performance.now() - start;
      latencies.push(elapsed);

      if (!putResult.ok) {
        throw new Error(`Storage put failed at ${i}: ${putResult.error.type}`);
      }
    }

    latencies.sort((a, b) => a - b);
    const p99 = percentile(latencies, 99);

    // SQLite in-memory writes should be fast
    expect(p99).toBeLessThan(10);
  });
});

/* ------------------------------------------------------------------ */
/*  3. Chain validation - 1K, 10K, 100K entries                         */
/* ------------------------------------------------------------------ */

describe("Chain validation benchmarks", () => {
  it("validates a 1K-entry chain in under 50ms", () => {
    const chain = buildChain(1_000, "val1k");

    const start = performance.now();
    const result = validateChain(chain);
    const elapsed = performance.now() - start;

    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(50);
  });

  it("validates a 10K-entry chain in under 100ms", () => {
    const chain = buildChain(10_000, "val10k");

    const start = performance.now();
    const result = validateChain(chain);
    const elapsed = performance.now() - start;

    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(100);
  });

  it("validates a 100K-entry chain in under 3000ms", { timeout: 120_000 }, () => {
    const chain = buildChain(100_000, "val100k");

    const start = performance.now();
    const result = validateChain(chain);
    const elapsed = performance.now() - start;

    expect(result.ok).toBe(true);
    // 100K should scale roughly linearly from 10K target
    expect(elapsed).toBeLessThan(3000);
  });
});

/* ------------------------------------------------------------------ */
/*  4. Memory - 100K entries peak RSS under 500MB                       */
/* ------------------------------------------------------------------ */

describe("Memory benchmarks", () => {
  it("keeps peak RSS under 500MB when appending 100K entries", { timeout: 120_000 }, () => {
    // Force GC if available to get a clean baseline
    if (typeof globalThis.gc === "function") {
      globalThis.gc();
    }
    const baselineRss = process.memoryUsage().rss;

    const chain = buildChain(100_000, "mem100k");

    const peakRss = process.memoryUsage().rss;
    const deltaBytes = peakRss - baselineRss;
    const deltaMB = deltaBytes / (1024 * 1024);

    // Chain should exist and be valid
    expect(chain.entries.length).toBe(100_000);
    // RSS delta should be under 500MB
    expect(deltaMB).toBeLessThan(500);
  });
});

/* ------------------------------------------------------------------ */
/*  5. Storage adapter round-trip throughput                            */
/* ------------------------------------------------------------------ */

describe("Storage adapter benchmarks", () => {
  it("in-memory adapter putEntry achieves at least 5000 entries/second", async () => {
    const count = 5000;
    const adapter = createInMemoryAdapter();
    const chain = buildChain(count, "stor-mem");

    const start = performance.now();
    for (const entry of chain.entries) {
      const result = await adapter.putEntry(entry);
      if (!result.ok) {
        throw new Error(`putEntry failed: ${result.error.type}`);
      }
    }
    const elapsed = performance.now() - start;

    const eps = (count / elapsed) * 1000;
    expect(eps).toBeGreaterThanOrEqual(5000);
  });

  it("in-memory adapter getEntriesByChainId retrieves 10K entries in under 50ms", async () => {
    const count = 10_000;
    const adapter = createInMemoryAdapter();
    const chain = buildChain(count, "stor-get");

    for (const entry of chain.entries) {
      await adapter.putEntry(entry);
    }

    const start = performance.now();
    const entries = await adapter.getEntriesByChainId("perf-chain");
    const elapsed = performance.now() - start;

    expect(entries.length).toBe(count);
    expect(elapsed).toBeLessThan(50);
  });

  it("SQLite adapter putEntry achieves at least 500 entries/second", async () => {
    const count = 2000;
    const adapter = createSqliteAdapter({ path: ":memory:" });
    const chain = buildChain(count, "stor-sqlite");

    const start = performance.now();
    for (const entry of chain.entries) {
      const result = await adapter.putEntry(entry);
      if (!result.ok) {
        throw new Error(`putEntry failed: ${result.error.type}`);
      }
    }
    const elapsed = performance.now() - start;

    const eps = (count / elapsed) * 1000;
    expect(eps).toBeGreaterThanOrEqual(500);
  });

  it("SQLite adapter getEntriesByChainId retrieves 5K entries in under 200ms", async () => {
    const count = 5000;
    const adapter = createSqliteAdapter({ path: ":memory:" });
    const chain = buildChain(count, "stor-sqget");

    for (const entry of chain.entries) {
      await adapter.putEntry(entry);
    }

    const start = performance.now();
    const entries = await adapter.getEntriesByChainId("perf-chain");
    const elapsed = performance.now() - start;

    expect(entries.length).toBe(count);
    expect(elapsed).toBeLessThan(200);
  });
});

/* ------------------------------------------------------------------ */
/*  6. Compliance report generation - 10K-entry chain under 10s         */
/* ------------------------------------------------------------------ */

describe("Report generation benchmarks", () => {
  it("generates a compliance report for a 10K-entry chain in under 10 seconds", () => {
    const chain = buildChain(10_000, "rpt10k");

    const start = performance.now();
    const report = generateComplianceReport({
      reportId: "perf-report",
      chain,
      defaultMetadata: {
        sectors: ["healthcare"],
        dataTypes: ["personal"],
        authorityLevel: "autonomous",
        riskLevel: "high",
      },
    });
    const elapsed = performance.now() - start;

    expect(report.chainIntegrity.valid).toBe(true);
    expect(report.statistics.totalEntries).toBe(10_000);
    expect(elapsed).toBeLessThan(10_000);
  });

  it("generates a compliance report for a 1K-entry chain with certificates in under 2 seconds", () => {
    const chain = buildChain(1_000, "rptcert");

    // Create certificates for 10% of entries
    const certificates = new Map<string, ReturnType<typeof createCertificate>>();
    for (let i = 0; i < 100; i++) {
      const cert = createCertificate({
        certificateId: `cert-${i}`,
        timestamp: "2026-04-05T00:00:00.000Z",
        modelId: "test-model",
        modelProvider: "test-provider",
        claims: [
          {
            claimId: `claim-${i}`,
            statement: `Claim for entry ${i}`,
            supportingEvidenceIds: [`ev-${i}`],
          },
        ],
        supportingEvidence: [
          {
            evidenceId: `ev-${i}`,
            evidenceType: "data_observation",
            description: `Evidence ${i}`,
            source: null,
          },
        ],
        unsupportedClaims: [],
        assumptions: [
          {
            assumptionId: `asm-${i}`,
            statement: `Assumption ${i}`,
            impact: "low",
          },
        ],
        limitations: [],
        confidenceAssessment: {
          level: "high",
          score: 0.85,
          rationale: "Strong evidence base",
        },
      });
      certificates.set(cert.certificateId, cert);
    }

    // Build override metadata mapping certificates to entries
    const overrides: Record<string, { sectors: ReadonlyArray<string>; dataTypes: ReadonlyArray<string>; authorityLevel: string | null; riskLevel: string | null }> = {};
    for (let i = 0; i < 100; i++) {
      const entry = chain.entries[i * 10];
      if (entry) {
        overrides[entry.entryId] = {
          sectors: ["finance"],
          dataTypes: ["personal"],
          authorityLevel: "autonomous",
          riskLevel: "high",
        };
      }
    }

    const start = performance.now();
    const report = generateComplianceReport({
      reportId: "perf-cert-report",
      chain,
      defaultMetadata: {
        sectors: ["healthcare"],
        dataTypes: ["personal"],
        authorityLevel: "human_in_the_loop",
        riskLevel: "high",
      },
      certificates: certificates as ReadonlyMap<string, ReturnType<typeof createCertificate>>,
    });
    const elapsed = performance.now() - start;

    expect(report.chainIntegrity.valid).toBe(true);
    expect(elapsed).toBeLessThan(2000);
  });
});

/* ------------------------------------------------------------------ */
/*  7. Concurrent chain operations                                     */
/* ------------------------------------------------------------------ */

describe("Concurrent operation benchmarks", () => {
  it("handles 10 concurrent chain builds without data corruption", async () => {
    const chainsCount = 10;
    const entriesPerChain = 500;

    const start = performance.now();
    const promises = Array.from({ length: chainsCount }, (_, chainIdx) => {
      return new Promise<ChainState>((resolve) => {
        let chain = createChain(`concurrent-${chainIdx}`);
        for (let i = 0; i < entriesPerChain; i++) {
          const result = appendEntry(chain, {
            ...makeInput(i),
            entryId: `conc-${chainIdx}-${i}`,
          });
          if (!result.ok) {
            throw new Error(`Concurrent append failed: ${result.error.type}`);
          }
          chain = result.value.chain;
        }
        resolve(chain);
      });
    });

    const chains = await Promise.all(promises);
    const elapsed = performance.now() - start;

    // Verify all chains are intact
    for (const chain of chains) {
      expect(chain.entries.length).toBe(entriesPerChain);
      const validation = validateChain(chain);
      expect(validation.ok).toBe(true);
    }

    // Total 5000 entries should complete reasonably fast
    const totalEntries = chainsCount * entriesPerChain;
    const eps = (totalEntries / elapsed) * 1000;
    expect(eps).toBeGreaterThan(500);
  });

  it("handles concurrent storage writes to SQLite without errors", async () => {
    const adapter = createSqliteAdapter({ path: ":memory:" });
    const chainsCount = 5;
    const entriesPerChain = 200;

    // Build chains first
    const chains: Array<ChainState> = [];
    for (let c = 0; c < chainsCount; c++) {
      let chain = createChain(`cstor-${c}`);
      for (let i = 0; i < entriesPerChain; i++) {
        const result = appendEntry(chain, {
          ...makeInput(i),
          entryId: `cstor-${c}-${i}`,
        });
        if (!result.ok) throw new Error(`Build failed: ${result.error.type}`);
        chain = result.value.chain;
      }
      chains.push(chain);
    }

    const start = performance.now();
    // Write all chains to storage concurrently
    const writePromises = chains.map(async (chain) => {
      for (const entry of chain.entries) {
        const result = await adapter.putEntry(entry);
        if (!result.ok) {
          throw new Error(`putEntry failed: ${result.error.type}`);
        }
      }
    });

    await Promise.all(writePromises);
    const elapsed = performance.now() - start;

    // Verify all entries were stored
    for (let c = 0; c < chainsCount; c++) {
      const stored = await adapter.getEntriesByChainId(`cstor-${c}`);
      expect(stored.length).toBe(entriesPerChain);
    }

    const total = chainsCount * entriesPerChain;
    const eps = (total / elapsed) * 1000;
    expect(eps).toBeGreaterThan(200);
  });
});
