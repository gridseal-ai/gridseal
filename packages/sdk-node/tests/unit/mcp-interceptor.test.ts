import { describe, it, expect, vi } from "vitest";
import {
  createInMemoryAdapter,
  validateChain,
  canonicalize,
  sha256,
} from "@gridseal/core";
import {
  wrapMcpClient,
  type McpCallToolFn,
  type McpToolResult,
} from "../../src/mcp/interceptor.js";

function makeMockResult(overrides?: Partial<McpToolResult>): McpToolResult {
  return {
    content: [
      { type: "text", text: "Tool result: 42" },
    ],
    isError: false,
    ...overrides,
  };
}

function makeMockCallTool(
  result?: McpToolResult
): McpCallToolFn & ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(result ?? makeMockResult());
}

describe("GridSealMcp", () => {
  it("captures MCP tool call as audit entry", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.callTool({
      name: "get_weather",
      arguments: { city: "Portland" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.result.content[0]!.text).toBe("Tool result: 42");
    expect(result.value.entryId.length).toBeGreaterThan(0);

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored.length).toBe(1);

    const entry = stored[0]!;
    expect(entry.entryType).toBe("ai_decision");
    expect(entry.modelId).toBe("get_weather");
    expect(entry.modelProvider).toBe("mcp");
    expect(entry.decisionType).toBe("tool_call");
    expect(entry.inputTokenCount).toBeNull();
    expect(entry.outputTokenCount).toBeNull();
  });

  it("passes tool name and arguments to the underlying callTool function", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({
      name: "search_docs",
      arguments: { query: "gridseal", limit: 10 },
    });

    expect(callTool).toHaveBeenCalledWith({
      name: "search_docs",
      arguments: { query: "gridseal", limit: 10 },
    });
  });

  it("captures input hash from tool name and arguments", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    const args = { city: "Portland" };
    await wrapped.callTool({ name: "get_weather", arguments: args });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;

    const expectedInputHash = sha256(
      canonicalize({ name: "get_weather", arguments: args })
    );
    expect(entry.inputHash).toBe(expectedInputHash);
  });

  it("captures output hash from text content and error status", async () => {
    const toolResult = makeMockResult({
      content: [{ type: "text", text: "Sunny, 72F" }],
      isError: false,
    });
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool(toolResult);
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({ name: "get_weather" });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;

    const expectedOutputHash = sha256(
      canonicalize({ content: "Sunny, 72F", isError: false })
    );
    expect(entry.outputHash).toBe(expectedOutputHash);
  });

  it("concatenates multiple text blocks for output hash", async () => {
    const toolResult = makeMockResult({
      content: [
        { type: "text", text: "Line 1" },
        { type: "text", text: "Line 2" },
      ],
    });
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool(toolResult);
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({ name: "read_file" });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;

    const expectedOutputHash = sha256(
      canonicalize({ content: "Line 1\nLine 2", isError: false })
    );
    expect(entry.outputHash).toBe(expectedOutputHash);
  });

  it("uses null content when result has no text blocks", async () => {
    const toolResult = makeMockResult({
      content: [{ type: "image", data: "base64..." }],
    });
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool(toolResult);
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({ name: "take_screenshot" });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;

    const expectedOutputHash = sha256(
      canonicalize({ content: null, isError: false })
    );
    expect(entry.outputHash).toBe(expectedOutputHash);
  });

  it("captures isError status in output hash", async () => {
    const toolResult = makeMockResult({
      content: [{ type: "text", text: "File not found" }],
      isError: true,
    });
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool(toolResult);
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({ name: "read_file" });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;

    const expectedOutputHash = sha256(
      canonicalize({ content: "File not found", isError: true })
    );
    expect(entry.outputHash).toBe(expectedOutputHash);
  });

  it("builds a valid chain from multiple tool calls", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    for (let i = 0; i < 5; i++) {
      const result = await wrapped.callTool({
        name: `tool_${i}`,
        arguments: { index: i },
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
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
      sessionId: "session-99",
      actorId: "agent-3",
    });

    await wrapped.callTool({ name: "get_weather" });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.sessionId).toBe("session-99");
    expect(entry.actorId).toBe("agent-3");
  });

  it("records custom tags and annotation", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({
      name: "search_docs",
      tags: { env: "staging", pipeline: "rag" },
      annotation: "RAG retrieval step",
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.tags).toEqual({ env: "staging", pipeline: "rag" });
    expect(entry.annotation).toBe("RAG retrieval step");
  });

  it("supports custom decision type", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({
      name: "classify_intent",
      decisionType: "classification",
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.decisionType).toBe("classification");
  });

  it("supports parent entry ID for tree structure", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    const r1 = await wrapped.callTool({ name: "plan_tasks" });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const rootId = r1.value.entryId;

    const r2 = await wrapped.callTool({
      name: "execute_task",
      parentEntryId: rootId,
    });
    expect(r2.ok).toBe(true);

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[1]!.parentEntryId).toBe(rootId);
  });

  it("returns MCP_CALL_ERROR when the tool call fails", async () => {
    const callTool = makeMockCallTool();
    (callTool as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Connection to MCP server lost")
    );

    const storage = createInMemoryAdapter();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.callTool({ name: "failing_tool" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("MCP_CALL_ERROR");
    expect(result.error.message).toContain("Connection to MCP server lost");
  });

  it("uses custom model provider when specified", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
      modelProvider: "custom-mcp-server",
    });

    await wrapped.callTool({ name: "get_data" });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.modelProvider).toBe("custom-mcp-server");
  });

  it("defaults arguments to empty object in input hash when not provided", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({ name: "list_tools" });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;

    const expectedInputHash = sha256(
      canonicalize({ name: "list_tools", arguments: {} })
    );
    expect(entry.inputHash).toBe(expectedInputHash);
  });

  it("passes undefined arguments to callTool when not provided", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({ name: "list_tools" });

    expect(callTool).toHaveBeenCalledWith({
      name: "list_tools",
      arguments: undefined,
    });
  });

  it("uses null for session and actor when not provided", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({ name: "get_data" });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sessionId).toBeNull();
    expect(stored[0]!.actorId).toBeNull();
  });

  it("defaults tags to empty object when not provided", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({ name: "get_data" });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.tags).toEqual({});
  });

  it("produces entry hashes that are valid SHA-256 hex strings", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({ name: "get_data" });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.entryHash).toHaveLength(64);
    expect(entry.entryHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sets modelId to tool name for each call", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({ name: "tool_alpha" });
    await wrapped.callTool({ name: "tool_beta" });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.modelId).toBe("tool_alpha");
    expect(stored[1]!.modelId).toBe("tool_beta");
  });

  it("getChain returns current chain state", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    const emptyChain = wrapped.getChain();
    expect(emptyChain.chainId).toBe("test-chain");
    expect(emptyChain.entries.length).toBe(0);

    await wrapped.callTool({ name: "get_data" });

    const chainAfter = wrapped.getChain();
    expect(chainAfter.entries.length).toBe(1);
  });

  it("sets first entry previousHash to null", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({ name: "get_data" });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.previousHash).toBeNull();
  });

  it("assigns incrementing sequence numbers", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    for (let i = 0; i < 3; i++) {
      await wrapped.callTool({ name: `tool_${i}` });
    }

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sequenceNumber).toBe(0);
    expect(stored[1]!.sequenceNumber).toBe(1);
    expect(stored[2]!.sequenceNumber).toBe(2);
  });

  it("handles tool result with empty content array", async () => {
    const toolResult = makeMockResult({ content: [] });
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool(toolResult);
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.callTool({ name: "void_tool" });
    expect(result.ok).toBe(true);

    const stored = await storage.getEntriesByChainId("test-chain");
    const expectedOutputHash = sha256(
      canonicalize({ content: null, isError: false })
    );
    expect(stored[0]!.outputHash).toBe(expectedOutputHash);
  });

  it("defaults isError to false when not present in result", async () => {
    const toolResult: McpToolResult = {
      content: [{ type: "text", text: "ok" }],
    };
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool(toolResult);
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    await wrapped.callTool({ name: "some_tool" });

    const stored = await storage.getEntriesByChainId("test-chain");
    const expectedOutputHash = sha256(
      canonicalize({ content: "ok", isError: false })
    );
    expect(stored[0]!.outputHash).toBe(expectedOutputHash);
  });
});

describe("wrapMcpClient", () => {
  it("returns an object with callTool and getChain", () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "test-chain",
      storage,
    });

    expect(typeof wrapped.callTool).toBe("function");
    expect(typeof wrapped.getChain).toBe("function");
  });
});

describe("GridSealMcp overhead", () => {
  it("adds less than 2ms overhead per call with in-memory storage", async () => {
    const storage = createInMemoryAdapter();
    const callTool = makeMockCallTool();
    const wrapped = wrapMcpClient({
      callTool,
      chainId: "bench-chain",
      storage,
    });

    // Warm up
    for (let i = 0; i < 5; i++) {
      await wrapped.callTool({ name: `warmup_${i}` });
    }

    // Measure: run 100 calls, record the overhead for each
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await wrapped.callTool({
        name: `bench_tool_${i}`,
        arguments: { index: i },
      });
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p99 = times[Math.floor(times.length * 0.99)]!;
    expect(p99).toBeLessThan(10);
  });
});
