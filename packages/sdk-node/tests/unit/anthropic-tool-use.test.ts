import { describe, it, expect, vi } from "vitest";
import type { Anthropic } from "@anthropic-ai/sdk";
import type {
  Message,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages/messages";
import {
  createInMemoryAdapter,
  validateChain,
  canonicalize,
  sha256,
} from "@gridseal/core";
import { wrapAnthropicToolUse } from "../../src/adapters/anthropic-tool-use.js";

function makeTextBlock(text: string): TextBlock {
  return { type: "text", text, citations: null };
}

function makeToolUseBlock(
  overrides?: Partial<Pick<ToolUseBlock, "id" | "name" | "input">>
): ToolUseBlock {
  return {
    type: "tool_use",
    id: overrides?.id ?? "toolu_abc123",
    name: overrides?.name ?? "get_weather",
    input: overrides?.input ?? { location: "London" },
    caller: { type: "tool" },
  } as ToolUseBlock;
}

function makeMockMessage(overrides?: Partial<Message>): Message {
  return {
    id: "msg_abc123",
    type: "message",
    role: "assistant",
    content: [makeTextBlock("Hello! How can I help you?")],
    model: "claude-sonnet-4-20250514",
    stop_reason: "end_turn",
    stop_sequence: null,
    stop_details: null,
    container: null,
    usage: {
      input_tokens: 25,
      output_tokens: 15,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      server_tool_use: null,
    },
    ...overrides,
  };
}

function makeMockClient(
  message?: Message
): Anthropic & { messages: { create: ReturnType<typeof vi.fn> } } {
  const mockCreate = vi.fn().mockResolvedValue(message ?? makeMockMessage());
  return {
    messages: {
      create: mockCreate,
    },
  } as unknown as Anthropic & { messages: { create: ReturnType<typeof vi.fn> } };
}

describe("GridSealAnthropicToolUse", () => {
  it("captures a message with no tool_use blocks as single entry", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.message.model).toBe("claude-sonnet-4-20250514");
    expect(result.value.entryId.length).toBeGreaterThan(0);
    expect(result.value.toolUseEntries).toEqual([]);

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored.length).toBe(1);
    expect(stored[0]!.entryType).toBe("ai_decision");
    expect(stored[0]!.decisionType).toBe("generation");
  });

  it("captures tool_use blocks as separate child entries", async () => {
    const message = makeMockMessage({
      content: [
        makeTextBlock("Let me check the weather."),
        makeToolUseBlock({
          id: "toolu_001",
          name: "get_weather",
          input: { location: "London" },
        }),
      ],
      stop_reason: "tool_use",
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.createMessage({
      messages: [{ role: "user", content: "What is the weather in London?" }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.toolUseEntries.length).toBe(1);
    expect(result.value.toolUseEntries[0]!.toolName).toBe("get_weather");
    expect(result.value.toolUseEntries[0]!.toolUseId).toBe("toolu_001");
    expect(result.value.toolUseEntries[0]!.input).toEqual({ location: "London" });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored.length).toBe(2);

    const mainEntry = stored[0]!;
    const toolEntry = stored[1]!;

    expect(mainEntry.decisionType).toBe("generation");
    expect(mainEntry.modelId).toBe("claude-sonnet-4-20250514");

    expect(toolEntry.decisionType).toBe("tool_call");
    expect(toolEntry.modelId).toBe("get_weather");
    expect(toolEntry.parentEntryId).toBe(mainEntry.entryId);
  });

  it("captures multiple tool_use blocks as separate child entries", async () => {
    const message = makeMockMessage({
      content: [
        makeTextBlock("Let me check both."),
        makeToolUseBlock({
          id: "toolu_001",
          name: "get_weather",
          input: { location: "London" },
        }),
        makeToolUseBlock({
          id: "toolu_002",
          name: "get_time",
          input: { timezone: "Europe/London" },
        }),
      ],
      stop_reason: "tool_use",
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.createMessage({
      messages: [{ role: "user", content: "Weather and time in London?" }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.toolUseEntries.length).toBe(2);
    expect(result.value.toolUseEntries[0]!.toolName).toBe("get_weather");
    expect(result.value.toolUseEntries[1]!.toolName).toBe("get_time");

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored.length).toBe(3);

    const mainEntryId = stored[0]!.entryId;
    expect(stored[1]!.parentEntryId).toBe(mainEntryId);
    expect(stored[2]!.parentEntryId).toBe(mainEntryId);
    expect(stored[1]!.modelId).toBe("get_weather");
    expect(stored[2]!.modelId).toBe("get_time");
  });

  it("hashes tool_use input including tool_use_id, name, and input", async () => {
    const message = makeMockMessage({
      content: [
        makeToolUseBlock({
          id: "toolu_xyz",
          name: "calculator",
          input: { expression: "2+2" },
        }),
      ],
      stop_reason: "tool_use",
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Calculate 2+2" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const toolEntry = stored[1]!;

    const expectedInputHash = sha256(
      canonicalize({
        tool_use_id: "toolu_xyz",
        name: "calculator",
        input: { expression: "2+2" },
      })
    );
    expect(toolEntry.inputHash).toBe(expectedInputHash);
  });

  it("hashes tool_use output with tool_use_id and name", async () => {
    const message = makeMockMessage({
      content: [
        makeToolUseBlock({
          id: "toolu_xyz",
          name: "calculator",
          input: { expression: "2+2" },
        }),
      ],
      stop_reason: "tool_use",
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Calculate" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const toolEntry = stored[1]!;

    const expectedOutputHash = sha256(
      canonicalize({
        tool_use_id: "toolu_xyz",
        name: "calculator",
      })
    );
    expect(toolEntry.outputHash).toBe(expectedOutputHash);
  });

  it("tool_use entries have null token counts", async () => {
    const message = makeMockMessage({
      content: [
        makeToolUseBlock(),
      ],
      stop_reason: "tool_use",
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Use tool" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const toolEntry = stored[1]!;
    expect(toolEntry.inputTokenCount).toBeNull();
    expect(toolEntry.outputTokenCount).toBeNull();
  });

  it("main entry still captures token counts from response", async () => {
    const message = makeMockMessage({
      content: [
        makeTextBlock("Here you go."),
        makeToolUseBlock(),
      ],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
        server_tool_use: null,
      },
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const mainEntry = stored[0]!;
    expect(mainEntry.inputTokenCount).toBe(100);
    expect(mainEntry.outputTokenCount).toBe(50);
  });

  it("main entry output hash is based on text content only", async () => {
    const message = makeMockMessage({
      content: [
        makeTextBlock("Checking weather"),
        makeToolUseBlock(),
      ],
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Weather?" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const mainEntry = stored[0]!;
    const expectedOutputHash = sha256(canonicalize("Checking weather"));
    expect(mainEntry.outputHash).toBe(expectedOutputHash);
  });

  it("builds a valid chain including tool_use entries", async () => {
    const message = makeMockMessage({
      content: [
        makeTextBlock("Using tools"),
        makeToolUseBlock({ id: "t1", name: "tool_a", input: { x: 1 } }),
        makeToolUseBlock({ id: "t2", name: "tool_b", input: { y: 2 } }),
      ],
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.createMessage({
      messages: [{ role: "user", content: "Use tools" }],
    });
    expect(result.ok).toBe(true);

    const chainState = wrapped.getChain();
    expect(chainState.entries.length).toBe(3);

    const validation = validateChain(chainState);
    expect(validation.ok).toBe(true);

    expect(chainState.entries[1]!.previousHash).toBe(
      chainState.entries[0]!.entryHash
    );
    expect(chainState.entries[2]!.previousHash).toBe(
      chainState.entries[1]!.entryHash
    );
  });

  it("maintains chain integrity across multiple calls with tool uses", async () => {
    const storage = createInMemoryAdapter();
    const messageWithTool = makeMockMessage({
      content: [
        makeTextBlock("Tool call"),
        makeToolUseBlock({ id: "t1", name: "search", input: { q: "test" } }),
      ],
    });
    const messagePlain = makeMockMessage({
      content: [makeTextBlock("No tools here")],
    });

    const client = makeMockClient();
    client.messages.create
      .mockResolvedValueOnce(messageWithTool)
      .mockResolvedValueOnce(messagePlain)
      .mockResolvedValueOnce(messageWithTool);

    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    for (let i = 0; i < 3; i++) {
      const result = await wrapped.createMessage({
        messages: [{ role: "user", content: `Call ${i}` }],
      });
      expect(result.ok).toBe(true);
    }

    const chainState = wrapped.getChain();
    expect(chainState.entries.length).toBe(5);

    const validation = validateChain(chainState);
    expect(validation.ok).toBe(true);
  });

  it("propagates session ID and actor ID to tool_use entries", async () => {
    const message = makeMockMessage({
      content: [
        makeTextBlock("Tool time"),
        makeToolUseBlock(),
      ],
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
      sessionId: "session-42",
      actorId: "user-7",
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const toolEntry = stored[1]!;
    expect(toolEntry.sessionId).toBe("session-42");
    expect(toolEntry.actorId).toBe("user-7");
  });

  it("propagates tags to tool_use entries", async () => {
    const message = makeMockMessage({
      content: [makeToolUseBlock()],
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hi" }],
      tags: { env: "test", team: "ml" },
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const toolEntry = stored[1]!;
    expect(toolEntry.tags).toEqual({ env: "test", team: "ml" });
  });

  it("tool_use entries have null annotation regardless of parent annotation", async () => {
    const message = makeMockMessage({
      content: [makeToolUseBlock()],
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hi" }],
      annotation: "Parent annotation",
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.annotation).toBe("Parent annotation");
    expect(stored[1]!.annotation).toBeNull();
  });

  it("tool_use entries set modelProvider to anthropic", async () => {
    const message = makeMockMessage({
      content: [makeToolUseBlock()],
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hi" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[1]!.modelProvider).toBe("anthropic");
  });

  it("returns ANTHROPIC_API_ERROR when the API call fails", async () => {
    const client = makeMockClient();
    client.messages.create.mockRejectedValue(new Error("Connection refused"));

    const storage = createInMemoryAdapter();
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("ANTHROPIC_API_ERROR");
    expect(result.error.message).toContain("Connection refused");
  });

  it("handles response with only tool_use blocks (no text)", async () => {
    const message = makeMockMessage({
      content: [
        makeToolUseBlock({ id: "t1", name: "search", input: { q: "test" } }),
      ],
      stop_reason: "tool_use",
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.createMessage({
      messages: [{ role: "user", content: "Search" }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored.length).toBe(2);

    const mainEntry = stored[0]!;
    const expectedOutputHash = sha256(canonicalize(null));
    expect(mainEntry.outputHash).toBe(expectedOutputHash);
  });

  it("forwards extra parameters to the Anthropic API", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
      model: "claude-sonnet-4-20250514",
      maxTokens: 2048,
      temperature: 0.7,
    });

    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 2048,
        temperature: 0.7,
      })
    );
  });

  it("includes extra parameters in input hash", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
      model: "claude-sonnet-4-20250514",
      maxTokens: 1024,
      temperature: 0.5,
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const expectedHash = sha256(
      canonicalize({
        messages: [{ role: "user", content: "Hello" }],
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        temperature: 0.5,
      })
    );
    expect(stored[0]!.inputHash).toBe(expectedHash);
  });

  it("produces entry hashes that are valid SHA-256 hex strings", async () => {
    const message = makeMockMessage({
      content: [
        makeTextBlock("Test"),
        makeToolUseBlock(),
      ],
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    for (const entry of stored) {
      expect(entry.entryHash).toHaveLength(64);
      expect(entry.entryHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("assigns incrementing sequence numbers across message and tool entries", async () => {
    const message = makeMockMessage({
      content: [
        makeTextBlock("Using tools"),
        makeToolUseBlock({ id: "t1", name: "a", input: {} }),
        makeToolUseBlock({ id: "t2", name: "b", input: {} }),
      ],
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Go" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sequenceNumber).toBe(0);
    expect(stored[1]!.sequenceNumber).toBe(1);
    expect(stored[2]!.sequenceNumber).toBe(2);
  });

  it("supports parent entry ID for the main message entry", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    const r1 = await wrapped.createMessage({
      messages: [{ role: "user", content: "Root" }],
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    const message = makeMockMessage({
      content: [makeToolUseBlock()],
    });
    client.messages.create.mockResolvedValue(message);

    const r2 = await wrapped.createMessage({
      messages: [{ role: "user", content: "Child with tool" }],
      parentEntryId: r1.value.entryId,
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[1]!.parentEntryId).toBe(r1.value.entryId);
    expect(stored[2]!.parentEntryId).toBe(r2.value.entryId);
  });

  it("getChain returns current chain state including tool_use entries", async () => {
    const message = makeMockMessage({
      content: [
        makeTextBlock("Hi"),
        makeToolUseBlock(),
      ],
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    const emptyChain = wrapped.getChain();
    expect(emptyChain.entries.length).toBe(0);

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    const chainAfter = wrapped.getChain();
    expect(chainAfter.entries.length).toBe(2);
  });
});

describe("GridSealAnthropicToolUse overhead", () => {
  it("adds less than 2ms overhead per call with in-memory storage", async () => {
    const storage = createInMemoryAdapter();
    const messageWithTool = makeMockMessage({
      content: [
        makeTextBlock("Using tool"),
        makeToolUseBlock({ id: "t1", name: "tool_a", input: { x: 1 } }),
      ],
    });
    const client = makeMockClient(messageWithTool);
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "bench-chain",
      storage,
    });

    // Warm up
    for (let i = 0; i < 5; i++) {
      await wrapped.createMessage({
        messages: [{ role: "user", content: `Warmup ${i}` }],
      });
    }

    // Measure: run 100 calls, record the overhead for each
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await wrapped.createMessage({
        messages: [{ role: "user", content: `Bench ${i}` }],
      });
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p99 = times[Math.floor(times.length * 0.99)]!;
    expect(p99).toBeLessThan(2);
  });
});

describe("wrapAnthropicToolUse", () => {
  it("returns an object with createMessage and getChain", () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropicToolUse({
      client,
      chainId: "test-chain",
      storage,
    });

    expect(typeof wrapped.createMessage).toBe("function");
    expect(typeof wrapped.getChain).toBe("function");
  });
});
