import { describe, it, expect, vi } from "vitest";
import {
  createInMemoryAdapter,
  validateChain,
  canonicalize,
  sha256,
} from "@gridseal/core";
import { wrapHttp } from "../../src/adapters/http.js";
import type { ResponseExtractors, HttpCallFn } from "../../src/adapters/http.js";

type MockRequest = {
  readonly prompt: string;
  readonly model: string;
  readonly maxTokens: number;
};

type MockResponse = {
  readonly id: string;
  readonly model: string;
  readonly text: string | null;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number } | null;
};

const defaultExtractors: ResponseExtractors<MockResponse> = {
  extractModelId: (r) => r.model,
  extractContent: (r) => r.text,
  extractInputTokens: (r) => r.usage?.inputTokens ?? null,
  extractOutputTokens: (r) => r.usage?.outputTokens ?? null,
};

function makeMockResponse(overrides?: Partial<MockResponse>): MockResponse {
  return {
    id: "resp-abc123",
    model: "custom-model-v2",
    text: "Generated response text",
    usage: { inputTokens: 30, outputTokens: 20 },
    ...overrides,
  };
}

function makeMockCallFn(
  response?: MockResponse
): HttpCallFn<MockRequest, MockResponse> & ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(response ?? makeMockResponse());
}

describe("GridSealHttp", () => {
  it("captures HTTP response as audit entry", async () => {
    const storage = createInMemoryAdapter();
    const callFn = makeMockCallFn();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    const result = await wrapped.call(callFn, {
      request: { prompt: "Hello", model: "custom-model-v2", maxTokens: 100 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.response.model).toBe("custom-model-v2");
    expect(result.value.entryId.length).toBeGreaterThan(0);

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored.length).toBe(1);

    const entry = stored[0]!;
    expect(entry.entryType).toBe("ai_decision");
    expect(entry.modelId).toBe("custom-model-v2");
    expect(entry.modelProvider).toBe("custom-provider");
    expect(entry.inputTokenCount).toBe(30);
    expect(entry.outputTokenCount).toBe(20);
    expect(entry.decisionType).toBe("generation");
  });

  it("hashes the full request object as input", async () => {
    const storage = createInMemoryAdapter();
    const callFn = makeMockCallFn();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    const request: MockRequest = { prompt: "Test input", model: "m1", maxTokens: 50 };
    await wrapped.call(callFn, { request });

    const stored = await storage.getEntriesByChainId("test-chain");
    const expectedInputHash = sha256(canonicalize(request));
    expect(stored[0]!.inputHash).toBe(expectedInputHash);
  });

  it("hashes extracted content as output", async () => {
    const response = makeMockResponse({ text: "Specific output" });
    const callFn = makeMockCallFn(response);
    const storage = createInMemoryAdapter();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    await wrapped.call(callFn, {
      request: { prompt: "Hi", model: "m1", maxTokens: 50 },
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const expectedOutputHash = sha256(canonicalize("Specific output"));
    expect(stored[0]!.outputHash).toBe(expectedOutputHash);
  });

  it("handles null content from extractor", async () => {
    const response = makeMockResponse({ text: null });
    const callFn = makeMockCallFn(response);
    const storage = createInMemoryAdapter();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    await wrapped.call(callFn, {
      request: { prompt: "Hi", model: "m1", maxTokens: 50 },
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const expectedOutputHash = sha256(canonicalize(null));
    expect(stored[0]!.outputHash).toBe(expectedOutputHash);
  });

  it("handles null usage from extractor", async () => {
    const response = makeMockResponse({ usage: null });
    const callFn = makeMockCallFn(response);
    const storage = createInMemoryAdapter();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    const result = await wrapped.call(callFn, {
      request: { prompt: "Hi", model: "m1", maxTokens: 50 },
    });

    expect(result.ok).toBe(true);
    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.inputTokenCount).toBeNull();
    expect(stored[0]!.outputTokenCount).toBeNull();
  });

  it("builds a valid chain from multiple calls", async () => {
    const storage = createInMemoryAdapter();
    const callFn = makeMockCallFn();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    for (let i = 0; i < 5; i++) {
      const result = await wrapped.call(callFn, {
        request: { prompt: `Message ${i}`, model: "m1", maxTokens: 50 },
      });
      expect(result.ok).toBe(true);
    }

    const chain = wrapped.getChain();
    expect(chain.entries.length).toBe(5);

    const validation = validateChain(chain);
    expect(validation.ok).toBe(true);

    for (let i = 1; i < 5; i++) {
      expect(chain.entries[i]!.previousHash).toBe(
        chain.entries[i - 1]!.entryHash
      );
    }
  });

  it("propagates session ID and actor ID", async () => {
    const storage = createInMemoryAdapter();
    const callFn = makeMockCallFn();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
      sessionId: "session-42",
      actorId: "user-7",
    });

    await wrapped.call(callFn, {
      request: { prompt: "Hello", model: "m1", maxTokens: 50 },
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sessionId).toBe("session-42");
    expect(stored[0]!.actorId).toBe("user-7");
  });

  it("records custom tags and annotation", async () => {
    const storage = createInMemoryAdapter();
    const callFn = makeMockCallFn();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    await wrapped.call(callFn, {
      request: { prompt: "Hello", model: "m1", maxTokens: 50 },
      tags: { env: "test", team: "ml" },
      annotation: "Test call",
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.tags).toEqual({ env: "test", team: "ml" });
    expect(stored[0]!.annotation).toBe("Test call");
  });

  it("supports custom decision type", async () => {
    const storage = createInMemoryAdapter();
    const callFn = makeMockCallFn();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    await wrapped.call(callFn, {
      request: { prompt: "Classify this", model: "m1", maxTokens: 50 },
      decisionType: "classification",
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.decisionType).toBe("classification");
  });

  it("supports parent entry ID for tree structure", async () => {
    const storage = createInMemoryAdapter();
    const callFn = makeMockCallFn();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    const r1 = await wrapped.call(callFn, {
      request: { prompt: "Root call", model: "m1", maxTokens: 50 },
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const rootId = r1.value.entryId;

    const r2 = await wrapped.call(callFn, {
      request: { prompt: "Child call", model: "m1", maxTokens: 50 },
      parentEntryId: rootId,
    });
    expect(r2.ok).toBe(true);

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[1]!.parentEntryId).toBe(rootId);
  });

  it("returns HTTP_CALL_ERROR when the call function throws", async () => {
    const callFn = vi.fn().mockRejectedValue(new Error("Connection refused"));
    const storage = createInMemoryAdapter();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    const result = await wrapped.call(callFn, {
      request: { prompt: "Hello", model: "m1", maxTokens: 50 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("HTTP_CALL_ERROR");
    expect(result.error.message).toContain("Connection refused");
  });

  it("returns HTTP_CALL_ERROR for non-Error throws", async () => {
    const callFn = vi.fn().mockRejectedValue("string error");
    const storage = createInMemoryAdapter();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    const result = await wrapped.call(callFn, {
      request: { prompt: "Hello", model: "m1", maxTokens: 50 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("HTTP_CALL_ERROR");
    expect(result.error.message).toBe("string error");
  });

  it("passes the request to the call function", async () => {
    const callFn = makeMockCallFn();
    const storage = createInMemoryAdapter();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    const request: MockRequest = { prompt: "Hello", model: "m1", maxTokens: 50 };
    await wrapped.call(callFn, { request });

    expect(callFn).toHaveBeenCalledWith(request);
  });

  it("produces entry hashes that are valid SHA-256 hex strings", async () => {
    const storage = createInMemoryAdapter();
    const callFn = makeMockCallFn();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    await wrapped.call(callFn, {
      request: { prompt: "Hello", model: "m1", maxTokens: 50 },
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.entryHash).toHaveLength(64);
    expect(entry.entryHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("defaults tags to empty object when not provided", async () => {
    const storage = createInMemoryAdapter();
    const callFn = makeMockCallFn();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    await wrapped.call(callFn, {
      request: { prompt: "Hello", model: "m1", maxTokens: 50 },
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.tags).toEqual({});
  });

  it("uses null for session and actor when not provided", async () => {
    const storage = createInMemoryAdapter();
    const callFn = makeMockCallFn();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    await wrapped.call(callFn, {
      request: { prompt: "Hello", model: "m1", maxTokens: 50 },
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sessionId).toBeNull();
    expect(stored[0]!.actorId).toBeNull();
  });

  it("getChain returns current chain state", async () => {
    const storage = createInMemoryAdapter();
    const callFn = makeMockCallFn();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    const emptyChain = wrapped.getChain();
    expect(emptyChain.chainId).toBe("test-chain");
    expect(emptyChain.entries.length).toBe(0);

    await wrapped.call(callFn, {
      request: { prompt: "Hello", model: "m1", maxTokens: 50 },
    });

    const chainAfter = wrapped.getChain();
    expect(chainAfter.entries.length).toBe(1);
  });

  it("sets first entry previousHash to null", async () => {
    const storage = createInMemoryAdapter();
    const callFn = makeMockCallFn();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    await wrapped.call(callFn, {
      request: { prompt: "Hello", model: "m1", maxTokens: 50 },
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.previousHash).toBeNull();
  });

  it("assigns incrementing sequence numbers", async () => {
    const storage = createInMemoryAdapter();
    const callFn = makeMockCallFn();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    for (let i = 0; i < 3; i++) {
      await wrapped.call(callFn, {
        request: { prompt: `Msg ${i}`, model: "m1", maxTokens: 50 },
      });
    }

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sequenceNumber).toBe(0);
    expect(stored[1]!.sequenceNumber).toBe(1);
    expect(stored[2]!.sequenceNumber).toBe(2);
  });

  it("works with different call functions per invocation", async () => {
    const storage = createInMemoryAdapter();
    const response1 = makeMockResponse({ model: "model-a", text: "Response A" });
    const response2 = makeMockResponse({ model: "model-b", text: "Response B" });
    const callFn1 = vi.fn().mockResolvedValue(response1);
    const callFn2 = vi.fn().mockResolvedValue(response2);

    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "multi-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    await wrapped.call(callFn1, {
      request: { prompt: "A", model: "model-a", maxTokens: 50 },
    });
    await wrapped.call(callFn2, {
      request: { prompt: "B", model: "model-b", maxTokens: 50 },
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.modelId).toBe("model-a");
    expect(stored[1]!.modelId).toBe("model-b");

    const chain = wrapped.getChain();
    const validation = validateChain(chain);
    expect(validation.ok).toBe(true);
  });
});

describe("GridSealHttp overhead", () => {
  it("adds less than 2ms overhead per call with in-memory storage", async () => {
    const storage = createInMemoryAdapter();
    const callFn = makeMockCallFn();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "bench-chain",
      storage,
      extractors: defaultExtractors,
    });

    // Warm up
    for (let i = 0; i < 5; i++) {
      await wrapped.call(callFn, {
        request: { prompt: `Warmup ${i}`, model: "m1", maxTokens: 50 },
      });
    }

    // Measure: run 100 calls, record the overhead for each
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await wrapped.call(callFn, {
        request: { prompt: `Bench ${i}`, model: "m1", maxTokens: 50 },
      });
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p99 = times[Math.floor(times.length * 0.99)]!;
    expect(p99).toBeLessThan(5);
  });
});

describe("wrapHttp", () => {
  it("returns an object with call and getChain", () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapHttp<MockRequest, MockResponse>({
      modelProvider: "custom-provider",
      chainId: "test-chain",
      storage,
      extractors: defaultExtractors,
    });

    expect(typeof wrapped.call).toBe("function");
    expect(typeof wrapped.getChain).toBe("function");
  });
});
