/**
 * UAT Layer 5: Developer Perspective
 *
 * Simulates a developer integrating GridSeal into their application.
 * Tests SDK adapters (HTTP, LangGraph) writing entries that are then
 * queryable and verifiable through the API. Every test hits real code
 * paths with real storage -- no mocks, no stubs.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTenantApp } from "../../src/app.js";
import { createTenantSqliteAdapter } from "../../src/db/tenant-sqlite-adapter.js";
import { createTenantToken } from "../../src/jwt.js";
import {
  wrapHttp,
  type GridSealHttp,
  type ResponseExtractors,
} from "@gridseal/sdk-node";
import {
  wrapLangGraph,
  type GridSealLangGraph,
} from "@gridseal/sdk-node";
import {
  createInMemoryAdapter,
  validateChain,
  type StorageAdapter,
} from "@gridseal/core";
import type { Hono } from "hono";
import type { TenantSqliteHandle } from "../../src/db/tenant-sqlite-adapter.js";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const JWT_SECRET = "developer-uat-secret";
const TENANT = "developer-tenant";
const CHAIN_ID = "dev-sdk-chain";
const SESSION_ID = "dev-session-001";
const ACTOR_ID = "developer@example.com";

/* ------------------------------------------------------------------ */
/*  Fake AI service types (simulates a real HTTP AI endpoint)          */
/* ------------------------------------------------------------------ */

type FakeAiRequest = {
  readonly prompt: string;
  readonly model: string;
  readonly temperature?: number;
};

type FakeAiResponse = {
  readonly id: string;
  readonly model: string;
  readonly content: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
};

/** Extractors that tell the SDK how to pull audit data from our fake AI response. */
const FAKE_EXTRACTORS: ResponseExtractors<FakeAiResponse> = {
  extractModelId: (r) => r.model,
  extractContent: (r) => r.content,
  extractInputTokens: (r) => r.inputTokens,
  extractOutputTokens: (r) => r.outputTokens,
};

/** Simulates an AI API call. Returns a deterministic response based on request. */
function createFakeAiService(): (req: FakeAiRequest) => Promise<FakeAiResponse> {
  let callCount = 0;
  return async (req: FakeAiRequest): Promise<FakeAiResponse> => {
    callCount += 1;
    return {
      id: `resp-${callCount}`,
      model: req.model,
      content: `Response to: ${req.prompt} (call #${callCount})`,
      inputTokens: req.prompt.length,
      outputTokens: 20 + callCount,
    };
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function authHeader(): { Authorization: string } {
  return { Authorization: `Bearer ${createTenantToken(TENANT, JWT_SECRET)}` };
}

function jsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", ...authHeader() };
}

/* ================================================================== */
/*  Test Suite 1: SDK HTTP Adapter Integration                         */
/* ================================================================== */

describe("Developer UAT: SDK HTTP adapter integration", () => {
  let dbHandle: TenantSqliteHandle;
  let app: Hono;
  let tenantStorage: StorageAdapter;
  let sdkWrapper: GridSealHttp<FakeAiRequest, FakeAiResponse>;
  let fakeAi: (req: FakeAiRequest) => Promise<FakeAiResponse>;
  const capturedEntryIds: Array<string> = [];

  beforeAll(async () => {
    dbHandle = createTenantSqliteAdapter();
    tenantStorage = dbHandle.forTenant(TENANT);

    app = createTenantApp({
      storageFactory: dbHandle.forTenant,
      jwtSecret: JWT_SECRET,
    });

    fakeAi = createFakeAiService();

    sdkWrapper = wrapHttp<FakeAiRequest, FakeAiResponse>({
      modelProvider: "fake-ai-corp",
      chainId: CHAIN_ID,
      storage: tenantStorage,
      extractors: FAKE_EXTRACTORS,
      sessionId: SESSION_ID,
      actorId: ACTOR_ID,
    });

    // Make 10 AI calls through the SDK
    for (let i = 0; i < 10; i++) {
      const result = await sdkWrapper.call(fakeAi, {
        request: { prompt: `Question ${i + 1}: What is ${i + 1} + ${i + 1}?`, model: "fake-model-v2" },
        decisionType: "generation",
        tags: { batch: "sdk-test", index: String(i) },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        capturedEntryIds.push(result.value.entryId);
      }
    }
  }, 30000);

  afterAll(() => {
    dbHandle.close();
  });

  it("creates exactly 10 entries visible through the API", async () => {
    const res = await app.request(`/chains/${CHAIN_ID}/entries?limit=100`, {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { entries: Array<Record<string, unknown>>; total: number };
    expect(body.total).toBe(10);
    expect(body.entries).toHaveLength(10);
  });

  it("each entry has correct input_hash, output_hash, model_id, and timestamp", async () => {
    const res = await app.request(`/chains/${CHAIN_ID}/entries?limit=100`, {
      headers: authHeader(),
    });
    const body = await res.json() as { entries: Array<Record<string, unknown>> };

    for (const entry of body.entries) {
      expect(entry.modelId).toBe("fake-model-v2");
      expect(entry.modelProvider).toBe("fake-ai-corp");
      expect(typeof entry.inputHash).toBe("string");
      expect((entry.inputHash as string).length).toBe(64);
      expect(typeof entry.outputHash).toBe("string");
      expect((entry.outputHash as string).length).toBe(64);
      expect(typeof entry.timestamp).toBe("string");
      expect(new Date(entry.timestamp as string).getTime()).not.toBeNaN();
    }
  });

  it("each entry has the correct sessionId and actorId from SDK config", async () => {
    const res = await app.request(`/chains/${CHAIN_ID}/entries?limit=100`, {
      headers: authHeader(),
    });
    const body = await res.json() as { entries: Array<Record<string, unknown>> };

    for (const entry of body.entries) {
      expect(entry.sessionId).toBe(SESSION_ID);
      expect(entry.actorId).toBe(ACTOR_ID);
    }
  });

  it("entries are correctly ordered by sequence number", async () => {
    const res = await app.request(`/chains/${CHAIN_ID}/entries?limit=100`, {
      headers: authHeader(),
    });
    const body = await res.json() as { entries: Array<{ sequenceNumber: number }> };

    for (let i = 1; i < body.entries.length; i++) {
      expect(body.entries[i].sequenceNumber).toBeGreaterThan(
        body.entries[i - 1].sequenceNumber,
      );
    }
  });

  it("chain validates successfully after SDK writes", async () => {
    const res = await app.request(`/chains/${CHAIN_ID}/validate`, {
      method: "POST",
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { valid: boolean; entryCount: number };
    expect(body.valid).toBe(true);
    expect(body.entryCount).toBe(10);
  });

  it("individual entries are retrievable by ID through the API", async () => {
    for (const entryId of capturedEntryIds) {
      const res = await app.request(`/chains/${CHAIN_ID}/entries/${entryId}`, {
        headers: authHeader(),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { entry: { entryId: string } };
      expect(body.entry.entryId).toBe(entryId);
    }
  });

  it("SDK tags are preserved and queryable", async () => {
    const res = await app.request(`/chains/${CHAIN_ID}/entries?limit=100`, {
      headers: authHeader(),
    });
    const body = await res.json() as { entries: Array<{ tags: Record<string, string> }> };

    for (let i = 0; i < body.entries.length; i++) {
      expect(body.entries[i].tags.batch).toBe("sdk-test");
    }
  });

  it("SDK getChain returns consistent state with 10 entries", () => {
    const chainState = sdkWrapper.getChain();
    expect(chainState.chainId).toBe(CHAIN_ID);
    expect(chainState.entries).toHaveLength(10);
  });
});

/* ================================================================== */
/*  Test Suite 2: LangGraph Framework Adapter                          */
/* ================================================================== */

describe("Developer UAT: LangGraph adapter creates correct tree structure", () => {
  let dbHandle: TenantSqliteHandle;
  let app: Hono;
  let tenantStorage: StorageAdapter;

  const GRAPH_CHAIN_ID = "langgraph-chain";
  const nodeEntryIds: Record<string, string> = {};

  beforeAll(async () => {
    dbHandle = createTenantSqliteAdapter();
    tenantStorage = dbHandle.forTenant(TENANT);

    app = createTenantApp({
      storageFactory: dbHandle.forTenant,
      jwtSecret: JWT_SECRET,
    });

    // Simulate a simple 3-node LangGraph workflow:
    //   classify -> [generate, summarize]
    // classify is the root; generate and summarize are children
    const lg = wrapLangGraph({
      chainId: GRAPH_CHAIN_ID,
      storage: tenantStorage,
      modelProvider: "langgraph-local",
      sessionId: "graph-session-1",
      actorId: "graph-developer",
    });

    // Node 1: classify
    const classifyNode = lg.wrapNode(
      "classify",
      async (input: { text: string }) => ({ category: "technical", text: input.text }),
      { decisionType: "classification", tags: { step: "1" } },
    );

    const classifyResult = await classifyNode({ text: "How does GridSeal hash chaining work?" });
    expect(classifyResult.ok).toBe(true);
    if (classifyResult.ok) {
      nodeEntryIds.classify = classifyResult.value.entryId;
    }

    // Node 2: generate (child of classify)
    const generateNode = lg.wrapNode(
      "generate",
      async (input: { category: string; text: string }) => ({
        response: `Detailed answer about ${input.category}: ${input.text}`,
      }),
      {
        decisionType: "generation",
        parentEntryId: nodeEntryIds.classify,
        tags: { step: "2a" },
      },
    );

    const generateResult = await generateNode({
      category: "technical",
      text: "How does GridSeal hash chaining work?",
    });
    expect(generateResult.ok).toBe(true);
    if (generateResult.ok) {
      nodeEntryIds.generate = generateResult.value.entryId;
    }

    // Node 3: summarize (also child of classify)
    const summarizeNode = lg.wrapNode(
      "summarize",
      async (input: { category: string; text: string }) => ({
        summary: `TL;DR: ${input.category} question about ${input.text.slice(0, 20)}`,
      }),
      {
        decisionType: "summarization",
        parentEntryId: nodeEntryIds.classify,
        tags: { step: "2b" },
      },
    );

    const summarizeResult = await summarizeNode({
      category: "technical",
      text: "How does GridSeal hash chaining work?",
    });
    expect(summarizeResult.ok).toBe(true);
    if (summarizeResult.ok) {
      nodeEntryIds.summarize = summarizeResult.value.entryId;
    }
  }, 30000);

  afterAll(() => {
    dbHandle.close();
  });

  it("creates exactly 3 entries for the 3-node graph", async () => {
    const res = await app.request(`/chains/${GRAPH_CHAIN_ID}/entries?limit=100`, {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { entries: Array<Record<string, unknown>>; total: number };
    expect(body.total).toBe(3);
  });

  it("classify node is the root entry with no parent", async () => {
    const res = await app.request(
      `/chains/${GRAPH_CHAIN_ID}/entries/${nodeEntryIds.classify}`,
      { headers: authHeader() },
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { entry: { parentEntryId: string | null; modelId: string; decisionType: string } };
    expect(body.entry.parentEntryId).toBeNull();
    expect(body.entry.modelId).toBe("classify");
    expect(body.entry.decisionType).toBe("classification");
  });

  it("generate and summarize are children of classify", async () => {
    const res = await app.request(
      `/chains/${GRAPH_CHAIN_ID}/entries/${nodeEntryIds.classify}/children`,
      { headers: authHeader() },
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { children: Array<{ entryId: string; modelId: string }> };
    expect(body.children).toHaveLength(2);

    const childIds = body.children.map((c) => c.entryId).sort();
    const expectedIds = [nodeEntryIds.generate, nodeEntryIds.summarize].sort();
    expect(childIds).toEqual(expectedIds);

    const childNames = body.children.map((c) => c.modelId).sort();
    expect(childNames).toEqual(["generate", "summarize"]);
  });

  it("subtree rooted at classify contains all 3 entries", async () => {
    const res = await app.request(
      `/chains/${GRAPH_CHAIN_ID}/entries/${nodeEntryIds.classify}/subtree`,
      { headers: authHeader() },
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { entries: Array<{ entryId: string }> };
    expect(body.entries).toHaveLength(3);
  });

  it("chain validates successfully with tree-structured entries", async () => {
    const res = await app.request(`/chains/${GRAPH_CHAIN_ID}/validate`, {
      method: "POST",
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { valid: boolean; entryCount: number };
    expect(body.valid).toBe(true);
    expect(body.entryCount).toBe(3);
  });

  it("each node entry has correct input and output hashes that are valid SHA-256 hex", async () => {
    for (const id of Object.values(nodeEntryIds)) {
      const res = await app.request(`/chains/${GRAPH_CHAIN_ID}/entries/${id}`, {
        headers: authHeader(),
      });
      const body = await res.json() as { entry: { inputHash: string; outputHash: string } };
      expect(body.entry.inputHash).toMatch(/^[0-9a-f]{64}$/);
      expect(body.entry.outputHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

/* ================================================================== */
/*  Test Suite 3: Error Recovery                                       */
/* ================================================================== */

describe("Developer UAT: error recovery after failed writes", () => {
  let dbHandle: TenantSqliteHandle;
  let app: Hono;

  const RECOVERY_CHAIN = "recovery-chain";

  beforeAll(() => {
    dbHandle = createTenantSqliteAdapter();
    app = createTenantApp({
      storageFactory: dbHandle.forTenant,
      jwtSecret: JWT_SECRET,
    });
  });

  afterAll(() => {
    dbHandle.close();
  });

  it("chain remains valid after a rejected malformed entry mid-sequence", async () => {
    // Append 50 valid entries
    for (let i = 0; i < 50; i++) {
      const res = await app.request(`/chains/${RECOVERY_CHAIN}/entries`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          entryId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          entryType: "ai_decision",
          modelId: "recovery-model",
          modelProvider: "test",
          inputHash: "a".repeat(64),
          outputHash: "b".repeat(64),
          decisionType: "generation",
          tags: { phase: "before-error" },
        }),
      });
      expect(res.status).toBe(201);
    }

    // Attempt to append entry 51 with malformed data (missing required entryId)
    const badRes = await app.request(`/chains/${RECOVERY_CHAIN}/entries`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
      }),
    });
    expect(badRes.status).toBe(400);

    // Verify chain is still valid with 50 entries
    const validateRes = await app.request(`/chains/${RECOVERY_CHAIN}/validate`, {
      method: "POST",
      headers: authHeader(),
    });
    expect(validateRes.status).toBe(200);
    const validateBody = await validateRes.json() as { valid: boolean; entryCount: number };
    expect(validateBody.valid).toBe(true);
    expect(validateBody.entryCount).toBe(50);

    // Append 50 more valid entries after the error
    for (let i = 0; i < 50; i++) {
      const res = await app.request(`/chains/${RECOVERY_CHAIN}/entries`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          entryId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          entryType: "ai_decision",
          modelId: "recovery-model",
          modelProvider: "test",
          inputHash: "c".repeat(64),
          outputHash: "d".repeat(64),
          decisionType: "generation",
          tags: { phase: "after-error" },
        }),
      });
      expect(res.status).toBe(201);
    }

    // Verify full chain of 100 is valid
    const finalValidate = await app.request(`/chains/${RECOVERY_CHAIN}/validate`, {
      method: "POST",
      headers: authHeader(),
    });
    expect(finalValidate.status).toBe(200);
    const finalBody = await finalValidate.json() as { valid: boolean; entryCount: number };
    expect(finalBody.valid).toBe(true);
    expect(finalBody.entryCount).toBe(100);
  }, 60000);

  it("chain remains valid after a duplicate entry ID is rejected", async () => {
    const dupChain = "dup-recovery-chain";
    const fixedId = crypto.randomUUID();

    // Append entry with a fixed ID
    const first = await app.request(`/chains/${dupChain}/entries`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        entryId: fixedId,
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        modelId: "dup-model",
        modelProvider: "test",
        inputHash: "a".repeat(64),
        outputHash: "b".repeat(64),
        decisionType: "generation",
      }),
    });
    expect(first.status).toBe(201);

    // Try to append the same ID again
    const dup = await app.request(`/chains/${dupChain}/entries`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        entryId: fixedId,
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        modelId: "dup-model",
        modelProvider: "test",
        inputHash: "c".repeat(64),
        outputHash: "d".repeat(64),
        decisionType: "generation",
      }),
    });
    // Should be rejected (409 conflict or 400)
    expect([400, 409]).toContain(dup.status);

    // Append a new valid entry
    const third = await app.request(`/chains/${dupChain}/entries`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        modelId: "dup-model",
        modelProvider: "test",
        inputHash: "e".repeat(64),
        outputHash: "f".repeat(64),
        decisionType: "generation",
      }),
    });
    expect(third.status).toBe(201);

    // Validate chain
    const validateRes = await app.request(`/chains/${dupChain}/validate`, {
      method: "POST",
      headers: authHeader(),
    });
    expect(validateRes.status).toBe(200);
    const body = await validateRes.json() as { valid: boolean; entryCount: number };
    expect(body.valid).toBe(true);
    expect(body.entryCount).toBe(2);
  });
});

/* ================================================================== */
/*  Test Suite 4: SDK-to-API round-trip with chain validation          */
/* ================================================================== */

describe("Developer UAT: SDK writes are verifiable through independent chain validation", () => {
  let dbHandle: TenantSqliteHandle;
  let app: Hono;
  let tenantStorage: StorageAdapter;

  const ROUNDTRIP_CHAIN = "roundtrip-chain";
  const ENTRY_COUNT = 25;

  beforeAll(async () => {
    dbHandle = createTenantSqliteAdapter();
    tenantStorage = dbHandle.forTenant(TENANT);

    app = createTenantApp({
      storageFactory: dbHandle.forTenant,
      jwtSecret: JWT_SECRET,
    });

    const fakeAi = createFakeAiService();
    const wrapper = wrapHttp<FakeAiRequest, FakeAiResponse>({
      modelProvider: "roundtrip-provider",
      chainId: ROUNDTRIP_CHAIN,
      storage: tenantStorage,
      extractors: FAKE_EXTRACTORS,
      sessionId: "roundtrip-session",
    });

    for (let i = 0; i < ENTRY_COUNT; i++) {
      const result = await wrapper.call(fakeAi, {
        request: { prompt: `Roundtrip query ${i}`, model: "rt-model" },
      });
      expect(result.ok).toBe(true);
    }
  }, 30000);

  afterAll(() => {
    dbHandle.close();
  });

  it("API chain validation matches independent core library validation", async () => {
    // Validate via API
    const apiRes = await app.request(`/chains/${ROUNDTRIP_CHAIN}/validate`, {
      method: "POST",
      headers: authHeader(),
    });
    expect(apiRes.status).toBe(200);
    const apiBody = await apiRes.json() as { valid: boolean; entryCount: number };
    expect(apiBody.valid).toBe(true);
    expect(apiBody.entryCount).toBe(ENTRY_COUNT);

    // Validate independently using core library
    const entries = await tenantStorage.getEntriesByChainId(ROUNDTRIP_CHAIN);
    expect(entries).toHaveLength(ENTRY_COUNT);
    const coreResult = validateChain({ chainId: ROUNDTRIP_CHAIN, entries: [...entries] });
    expect(coreResult.ok).toBe(true);
  });

  it("entries retrieved via API match entries in storage exactly", async () => {
    const storageEntries = await tenantStorage.getEntriesByChainId(ROUNDTRIP_CHAIN);

    const apiRes = await app.request(
      `/chains/${ROUNDTRIP_CHAIN}/entries?limit=${ENTRY_COUNT}`,
      { headers: authHeader() },
    );
    const apiBody = await apiRes.json() as { entries: Array<Record<string, unknown>> };

    expect(apiBody.entries).toHaveLength(storageEntries.length);

    for (let i = 0; i < storageEntries.length; i++) {
      const stored = storageEntries[i];
      const apiEntry = apiBody.entries[i];
      expect(apiEntry.entryId).toBe(stored.entryId);
      expect(apiEntry.entryHash).toBe(stored.entryHash);
      expect(apiEntry.prevHash).toBe(stored.prevHash);
      expect(apiEntry.inputHash).toBe(stored.inputHash);
      expect(apiEntry.outputHash).toBe(stored.outputHash);
      expect(apiEntry.sequenceNumber).toBe(stored.sequenceNumber);
    }
  });

  it("compliance report can be generated from SDK-written entries", async () => {
    const res = await app.request(
      `/reports/colorado-sb205?chainId=${ROUNDTRIP_CHAIN}`,
      { headers: authHeader() },
    );
    expect(res.status).toBe(200);
    const body = await res.json() as {
      report: {
        reportId: string;
        chainIntegrity: { valid: boolean };
        statistics: { totalEntries: number };
      };
    };
    expect(body.report.reportId).toBeTruthy();
    expect(body.report.chainIntegrity.valid).toBe(true);
    expect(body.report.statistics.totalEntries).toBe(ENTRY_COUNT);
  });
});

/* ================================================================== */
/*  Test Suite 5: Onboarding speed (setup-to-first-verified-entry)     */
/* ================================================================== */

describe("Developer UAT: onboarding speed from setup to first verified entry", () => {
  it("creates and verifies a first audit entry in under 500ms (SDK ergonomics)", async () => {
    const start = performance.now();

    // Step 1: Create storage
    const storage = createInMemoryAdapter();

    // Step 2: Create SDK wrapper
    const fakeAi = createFakeAiService();
    const wrapper = wrapHttp<FakeAiRequest, FakeAiResponse>({
      modelProvider: "onboarding-test",
      chainId: "onboarding-chain",
      storage,
      extractors: FAKE_EXTRACTORS,
    });

    // Step 3: Make first AI call
    const result = await wrapper.call(fakeAi, {
      request: { prompt: "Hello world", model: "test-model" },
    });
    expect(result.ok).toBe(true);

    // Step 4: Verify chain
    const entries = await storage.getEntriesByChainId("onboarding-chain");
    const validation = validateChain({ chainId: "onboarding-chain", entries: [...entries] });
    expect(validation.ok).toBe(true);

    const elapsed = performance.now() - start;
    // Should complete well under 500ms (typical: < 10ms)
    expect(elapsed).toBeLessThan(500);
  });
});

/* ================================================================== */
/*  Test Suite 6: Multi-adapter convergence                            */
/* ================================================================== */

describe("Developer UAT: multiple SDK adapters writing to separate chains in shared storage", () => {
  let dbHandle: TenantSqliteHandle;
  let app: Hono;
  let tenantStorage: StorageAdapter;

  const CLASSIFIER_CHAIN = "classifier-chain";
  const PIPELINE_CHAIN = "pipeline-chain";

  beforeAll(async () => {
    dbHandle = createTenantSqliteAdapter();
    tenantStorage = dbHandle.forTenant(TENANT);

    app = createTenantApp({
      storageFactory: dbHandle.forTenant,
      jwtSecret: JWT_SECRET,
    });

    const fakeAi = createFakeAiService();

    // Adapter 1: HTTP wrapper for a "classification" service
    const classifierWrapper = wrapHttp<FakeAiRequest, FakeAiResponse>({
      modelProvider: "classifier-service",
      chainId: CLASSIFIER_CHAIN,
      storage: tenantStorage,
      extractors: FAKE_EXTRACTORS,
      sessionId: "multi-session",
    });

    // Append 5 classification entries
    for (let i = 0; i < 5; i++) {
      const res = await classifierWrapper.call(fakeAi, {
        request: { prompt: `Classify item ${i}`, model: "classifier-v1" },
        decisionType: "classification",
        tags: { adapter: "classifier" },
      });
      expect(res.ok).toBe(true);
    }

    // Adapter 2: LangGraph wrapper for a "processing" workflow
    const lgWrapper = wrapLangGraph({
      chainId: PIPELINE_CHAIN,
      storage: tenantStorage,
      modelProvider: "processing-pipeline",
      sessionId: "multi-session",
    });

    const processNode = lgWrapper.wrapNode(
      "process",
      async (input: { data: string }) => ({ processed: input.data.toUpperCase() }),
      { decisionType: "generation", tags: { adapter: "langgraph" } },
    );

    // Append 5 processing entries
    for (let i = 0; i < 5; i++) {
      const res = await processNode({ data: `item-${i}` });
      expect(res.ok).toBe(true);
    }
  }, 30000);

  afterAll(() => {
    dbHandle.close();
  });

  it("both chains are listed with correct entry counts", async () => {
    const res = await app.request("/chains", { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { chains: Array<{ chainId: string; entryCount: number }> };
    const classifierChain = body.chains.find((c) => c.chainId === CLASSIFIER_CHAIN);
    const pipelineChain = body.chains.find((c) => c.chainId === PIPELINE_CHAIN);
    expect(classifierChain).toBeDefined();
    expect(classifierChain?.entryCount).toBe(5);
    expect(pipelineChain).toBeDefined();
    expect(pipelineChain?.entryCount).toBe(5);
  });

  it("each chain validates independently", async () => {
    for (const chainId of [CLASSIFIER_CHAIN, PIPELINE_CHAIN]) {
      const res = await app.request(`/chains/${chainId}/validate`, {
        method: "POST",
        headers: authHeader(),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { valid: boolean; entryCount: number };
      expect(body.valid).toBe(true);
      expect(body.entryCount).toBe(5);
    }
  });

  it("classifier chain entries have classifier-service provider", async () => {
    const res = await app.request(`/chains/${CLASSIFIER_CHAIN}/entries?limit=100`, {
      headers: authHeader(),
    });
    const body = await res.json() as { entries: Array<{ modelProvider: string; tags: Record<string, string> }> };
    expect(body.entries).toHaveLength(5);
    for (const e of body.entries) {
      expect(e.modelProvider).toBe("classifier-service");
      expect(e.tags.adapter).toBe("classifier");
    }
  });

  it("pipeline chain entries have processing-pipeline provider", async () => {
    const res = await app.request(`/chains/${PIPELINE_CHAIN}/entries?limit=100`, {
      headers: authHeader(),
    });
    const body = await res.json() as { entries: Array<{ modelProvider: string; tags: Record<string, string> }> };
    expect(body.entries).toHaveLength(5);
    for (const e of body.entries) {
      expect(e.modelProvider).toBe("processing-pipeline");
      expect(e.tags.adapter).toBe("langgraph");
    }
  });
});

/* ================================================================== */
/*  Test Suite 7: SDK error handling for AI call failures              */
/* ================================================================== */

describe("Developer UAT: SDK gracefully handles AI service failures", () => {
  it("returns HTTP_CALL_ERROR when the AI service throws", async () => {
    const storage = createInMemoryAdapter();

    const wrapper = wrapHttp<FakeAiRequest, FakeAiResponse>({
      modelProvider: "failing-service",
      chainId: "error-chain",
      storage,
      extractors: FAKE_EXTRACTORS,
    });

    const failingAi = async (): Promise<FakeAiResponse> => {
      throw new Error("Service unavailable: rate limit exceeded");
    };

    const result = await wrapper.call(failingAi, {
      request: { prompt: "test", model: "fail-model" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("HTTP_CALL_ERROR");
      expect(result.error.message).toContain("rate limit exceeded");
    }

    // Chain should still be empty -- no partial entry was written
    const entries = await storage.getEntriesByChainId("error-chain");
    expect(entries).toHaveLength(0);
  });

  it("chain remains valid after a failed call followed by successful calls", async () => {
    const storage = createInMemoryAdapter();
    const fakeAi = createFakeAiService();

    const wrapper = wrapHttp<FakeAiRequest, FakeAiResponse>({
      modelProvider: "mixed-service",
      chainId: "mixed-chain",
      storage,
      extractors: FAKE_EXTRACTORS,
    });

    // Successful call
    const r1 = await wrapper.call(fakeAi, {
      request: { prompt: "first", model: "m1" },
    });
    expect(r1.ok).toBe(true);

    // Failed call
    const failingAi = async (): Promise<FakeAiResponse> => {
      throw new Error("Timeout");
    };
    const r2 = await wrapper.call(failingAi, {
      request: { prompt: "fail", model: "m1" },
    });
    expect(r2.ok).toBe(false);

    // Another successful call
    const r3 = await wrapper.call(fakeAi, {
      request: { prompt: "third", model: "m1" },
    });
    expect(r3.ok).toBe(true);

    // Chain should have 2 entries and be valid
    const entries = await storage.getEntriesByChainId("mixed-chain");
    expect(entries).toHaveLength(2);
    const validation = validateChain({ chainId: "mixed-chain", entries: [...entries] });
    expect(validation.ok).toBe(true);
  });
});
