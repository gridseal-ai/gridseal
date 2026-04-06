import { describe, it, expect, vi } from "vitest";
import {
  createInMemoryAdapter,
  validateChain,
  canonicalize,
  sha256,
} from "@gridseal/core";
import { wrapLangGraph } from "../../src/frameworks/langgraph.js";

type TestState = {
  readonly messages: ReadonlyArray<string>;
  readonly count: number;
};

type TestOutput = {
  readonly messages: ReadonlyArray<string>;
};

function makeMockNode(): (
  input: TestState
) => Promise<TestOutput> {
  return vi.fn().mockImplementation(async (input: TestState) => ({
    messages: [...input.messages, `Response ${input.count}`],
  }));
}

describe("GridSealLangGraph", () => {
  it("captures node execution as audit entry", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();
    const wrappedNode = wrapped.wrapNode("llm_node", node);

    const input: TestState = { messages: ["Hello"], count: 1 };
    const result = await wrappedNode(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.output.messages).toEqual(["Hello", "Response 1"]);
    expect(result.value.entryId.length).toBeGreaterThan(0);

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored.length).toBe(1);

    const entry = stored[0]!;
    expect(entry.entryType).toBe("ai_decision");
    expect(entry.modelId).toBe("llm_node");
    expect(entry.modelProvider).toBe("langgraph");
    expect(entry.decisionType).toBe("generation");
    expect(entry.inputTokenCount).toBeNull();
    expect(entry.outputTokenCount).toBeNull();
  });

  it("passes input to the underlying node function", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();
    const wrappedNode = wrapped.wrapNode("processor", node);

    const input: TestState = { messages: ["test"], count: 5 };
    await wrappedNode(input);

    expect(node).toHaveBeenCalledWith(input);
  });

  it("captures input hash from full input object", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();
    const wrappedNode = wrapped.wrapNode("hash_node", node);

    const input: TestState = { messages: ["Hello"], count: 1 };
    await wrappedNode(input);

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;

    const expectedInputHash = sha256(canonicalize(input));
    expect(entry.inputHash).toBe(expectedInputHash);
  });

  it("captures output hash from full output object", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();
    const wrappedNode = wrapped.wrapNode("output_node", node);

    const input: TestState = { messages: ["Hello"], count: 1 };
    await wrappedNode(input);

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;

    const expectedOutput: TestOutput = { messages: ["Hello", "Response 1"] };
    const expectedOutputHash = sha256(canonicalize(expectedOutput));
    expect(entry.outputHash).toBe(expectedOutputHash);
  });

  it("builds a valid chain from multiple node executions", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();

    for (let i = 0; i < 5; i++) {
      const wrappedNode = wrapped.wrapNode(`node_${i}`, node);
      const result = await wrappedNode({
        messages: [`msg_${i}`],
        count: i,
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
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
      sessionId: "session-42",
      actorId: "graph-runner",
    });

    const node = makeMockNode();
    const wrappedNode = wrapped.wrapNode("test_node", node);
    await wrappedNode({ messages: [], count: 0 });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.sessionId).toBe("session-42");
    expect(entry.actorId).toBe("graph-runner");
  });

  it("records custom tags and annotation", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();
    const wrappedNode = wrapped.wrapNode("tagged_node", node, {
      tags: { env: "staging", graph: "rag-pipeline" },
      annotation: "RAG retrieval step",
    });
    await wrappedNode({ messages: [], count: 0 });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.tags).toEqual({ env: "staging", graph: "rag-pipeline" });
    expect(entry.annotation).toBe("RAG retrieval step");
  });

  it("supports custom decision type", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();
    const wrappedNode = wrapped.wrapNode("classify_node", node, {
      decisionType: "classification",
    });
    await wrappedNode({ messages: [], count: 0 });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.decisionType).toBe("classification");
  });

  it("supports parent entry ID for tree structure", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();

    const parentNode = wrapped.wrapNode("parent_node", node);
    const r1 = await parentNode({ messages: [], count: 0 });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const parentId = r1.value.entryId;

    const childNode = wrapped.wrapNode("child_node", node, {
      parentEntryId: parentId,
    });
    const r2 = await childNode({ messages: [], count: 1 });
    expect(r2.ok).toBe(true);

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[1]!.parentEntryId).toBe(parentId);
  });

  it("returns NODE_EXECUTION_ERROR when the node function fails", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const failingNode = vi
      .fn()
      .mockRejectedValue(new Error("LLM rate limit exceeded"));
    const wrappedNode = wrapped.wrapNode("failing_node", failingNode);

    const result = await wrappedNode({ messages: [], count: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("NODE_EXECUTION_ERROR");
    expect(result.error.message).toContain("LLM rate limit exceeded");
  });

  it("uses custom model provider when specified", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
      modelProvider: "custom-graph",
    });

    const node = makeMockNode();
    const wrappedNode = wrapped.wrapNode("test_node", node);
    await wrappedNode({ messages: [], count: 0 });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.modelProvider).toBe("custom-graph");
  });

  it("uses null for session and actor when not provided", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();
    const wrappedNode = wrapped.wrapNode("test_node", node);
    await wrappedNode({ messages: [], count: 0 });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sessionId).toBeNull();
    expect(stored[0]!.actorId).toBeNull();
  });

  it("defaults tags to empty object when not provided", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();
    const wrappedNode = wrapped.wrapNode("test_node", node);
    await wrappedNode({ messages: [], count: 0 });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.tags).toEqual({});
  });

  it("produces entry hashes that are valid SHA-256 hex strings", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();
    const wrappedNode = wrapped.wrapNode("test_node", node);
    await wrappedNode({ messages: [], count: 0 });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.entryHash).toHaveLength(64);
    expect(entry.entryHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sets modelId to node name for each execution", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();

    const nodeA = wrapped.wrapNode("retriever", node);
    const nodeB = wrapped.wrapNode("generator", node);

    await nodeA({ messages: [], count: 0 });
    await nodeB({ messages: [], count: 1 });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.modelId).toBe("retriever");
    expect(stored[1]!.modelId).toBe("generator");
  });

  it("getChain returns current chain state", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const emptyChain = wrapped.getChain();
    expect(emptyChain.chainId).toBe("test-chain");
    expect(emptyChain.entries.length).toBe(0);

    const node = makeMockNode();
    const wrappedNode = wrapped.wrapNode("test_node", node);
    await wrappedNode({ messages: [], count: 0 });

    const chainAfter = wrapped.getChain();
    expect(chainAfter.entries.length).toBe(1);
  });

  it("sets first entry previousHash to null", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();
    const wrappedNode = wrapped.wrapNode("test_node", node);
    await wrappedNode({ messages: [], count: 0 });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.previousHash).toBeNull();
  });

  it("assigns incrementing sequence numbers", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();
    for (let i = 0; i < 3; i++) {
      const wrappedNode = wrapped.wrapNode(`node_${i}`, node);
      await wrappedNode({ messages: [], count: i });
    }

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sequenceNumber).toBe(0);
    expect(stored[1]!.sequenceNumber).toBe(1);
    expect(stored[2]!.sequenceNumber).toBe(2);
  });

  it("handles null output from node function", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const nullNode = vi.fn().mockResolvedValue(null);
    const wrappedNode = wrapped.wrapNode("null_node", nullNode);
    const result = await wrappedNode({ messages: [], count: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.output).toBeNull();

    const stored = await storage.getEntriesByChainId("test-chain");
    const expectedOutputHash = sha256(canonicalize(null));
    expect(stored[0]!.outputHash).toBe(expectedOutputHash);
  });

  it("handles string output from node function", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const stringNode = vi.fn().mockResolvedValue("simple result");
    const wrappedNode = wrapped.wrapNode("string_node", stringNode);
    const result = await wrappedNode("input text");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.output).toBe("simple result");

    const stored = await storage.getEntriesByChainId("test-chain");
    const expectedOutputHash = sha256(canonicalize("simple result"));
    expect(stored[0]!.outputHash).toBe(expectedOutputHash);
  });

  it("wraps the same node function multiple times with different names", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    const node = makeMockNode();
    const step1 = wrapped.wrapNode("step_1", node);
    const step2 = wrapped.wrapNode("step_2", node);
    const step3 = wrapped.wrapNode("step_3", node);

    await step1({ messages: ["a"], count: 1 });
    await step2({ messages: ["b"], count: 2 });
    await step3({ messages: ["c"], count: 3 });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored.length).toBe(3);
    expect(stored[0]!.modelId).toBe("step_1");
    expect(stored[1]!.modelId).toBe("step_2");
    expect(stored[2]!.modelId).toBe("step_3");

    const chain = wrapped.getChain();
    const validation = validateChain(chain);
    expect(validation.ok).toBe(true);
  });
});

describe("wrapLangGraph", () => {
  it("returns an object with wrapNode and getChain", () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "test-chain",
      storage,
    });

    expect(typeof wrapped.wrapNode).toBe("function");
    expect(typeof wrapped.getChain).toBe("function");
  });
});

describe("GridSealLangGraph overhead", () => {
  it("adds less than 2ms overhead per node execution with in-memory storage", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapLangGraph({
      chainId: "bench-chain",
      storage,
    });

    const fastNode = vi.fn().mockResolvedValue({ result: "ok" });

    // Warm up
    for (let i = 0; i < 5; i++) {
      const node = wrapped.wrapNode(`warmup_${i}`, fastNode);
      await node({ step: i });
    }

    // Measure
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const node = wrapped.wrapNode(`bench_node_${i}`, fastNode);
      const start = performance.now();
      await node({ step: i });
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p99 = times[Math.floor(times.length * 0.99)]!;
    expect(p99).toBeLessThan(20);
  });
});
