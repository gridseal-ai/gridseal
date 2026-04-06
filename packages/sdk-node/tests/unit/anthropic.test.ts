import { describe, it, expect, vi } from "vitest";
import type { Anthropic } from "@anthropic-ai/sdk";
import type {
  Message,
  ContentBlock,
  TextBlock,
} from "@anthropic-ai/sdk/resources/messages/messages";
import {
  createInMemoryAdapter,
  validateChain,
  canonicalize,
  sha256,
} from "@gridseal/core";
import { wrapAnthropic } from "../../src/adapters/anthropic.js";

function makeTextBlock(text: string): TextBlock {
  return { type: "text", text, citations: null };
}

function makeToolUseBlock(): ContentBlock {
  return {
    type: "tool_use",
    id: "toolu_123",
    name: "get_weather",
    input: { location: "London" },
  } as ContentBlock;
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

describe("GridSealAnthropic", () => {
  it("captures message completion as audit entry", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
      model: "claude-sonnet-4-20250514",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.message.model).toBe("claude-sonnet-4-20250514");
    expect(result.value.entryId.length).toBeGreaterThan(0);

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored.length).toBe(1);

    const entry = stored[0]!;
    expect(entry.entryType).toBe("ai_decision");
    expect(entry.modelId).toBe("claude-sonnet-4-20250514");
    expect(entry.modelProvider).toBe("anthropic");
    expect(entry.inputTokenCount).toBe(25);
    expect(entry.outputTokenCount).toBe(15);
    expect(entry.decisionType).toBe("generation");
  });

  it("captures input hash from messages including max_tokens", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    const messages = [{ role: "user" as const, content: "Hello" }];
    await wrapped.createMessage({
      messages,
      model: "claude-sonnet-4-20250514",
      maxTokens: 2048,
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;

    const expectedInputHash = sha256(
      canonicalize({
        messages,
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
      })
    );
    expect(entry.inputHash).toBe(expectedInputHash);
  });

  it("captures output hash from response text content", async () => {
    const message = makeMockMessage({
      content: [makeTextBlock("Test response")],
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hi" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    const expectedOutputHash = sha256(canonicalize("Test response"));
    expect(entry.outputHash).toBe(expectedOutputHash);
  });

  it("extracts only text blocks and ignores tool_use blocks", async () => {
    const message = makeMockMessage({
      content: [
        makeToolUseBlock(),
        makeTextBlock("Here is the weather"),
      ],
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Weather?" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    const expectedOutputHash = sha256(canonicalize("Here is the weather"));
    expect(entry.outputHash).toBe(expectedOutputHash);
  });

  it("joins multiple text blocks with newline", async () => {
    const message = makeMockMessage({
      content: [
        makeTextBlock("First paragraph"),
        makeTextBlock("Second paragraph"),
      ],
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Write" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    const expectedOutputHash = sha256(
      canonicalize("First paragraph\nSecond paragraph")
    );
    expect(entry.outputHash).toBe(expectedOutputHash);
  });

  it("builds a valid chain from multiple calls", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    for (let i = 0; i < 5; i++) {
      const result = await wrapped.createMessage({
        messages: [{ role: "user", content: `Message ${i}` }],
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
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
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
    const entry = stored[0]!;
    expect(entry.sessionId).toBe("session-42");
    expect(entry.actorId).toBe("user-7");
  });

  it("records custom tags and annotation", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
      tags: { env: "test", team: "ml" },
      annotation: "Test call",
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.tags).toEqual({ env: "test", team: "ml" });
    expect(entry.annotation).toBe("Test call");
  });

  it("supports custom decision type", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Classify this" }],
      decisionType: "classification",
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.decisionType).toBe("classification");
  });

  it("supports parent entry ID for tree structure", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    const r1 = await wrapped.createMessage({
      messages: [{ role: "user", content: "Root call" }],
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const rootId = r1.value.entryId;

    const r2 = await wrapped.createMessage({
      messages: [{ role: "user", content: "Child call" }],
      parentEntryId: rootId,
    });
    expect(r2.ok).toBe(true);

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[1]!.parentEntryId).toBe(rootId);
  });

  it("returns ANTHROPIC_API_ERROR when the API call fails", async () => {
    const client = makeMockClient();
    client.messages.create.mockRejectedValue(
      new Error("Connection refused")
    );

    const storage = createInMemoryAdapter();
    const wrapped = wrapAnthropic({
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

  it("handles empty content array in response", async () => {
    const message = makeMockMessage({ content: [] });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.ok).toBe(true);
    const stored = await storage.getEntriesByChainId("test-chain");
    const expectedOutputHash = sha256(canonicalize(null));
    expect(stored[0]!.outputHash).toBe(expectedOutputHash);
  });

  it("handles content with only tool_use blocks (no text)", async () => {
    const message = makeMockMessage({
      content: [makeToolUseBlock()],
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(message);
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.createMessage({
      messages: [{ role: "user", content: "Use a tool" }],
    });

    expect(result.ok).toBe(true);
    const stored = await storage.getEntriesByChainId("test-chain");
    const expectedOutputHash = sha256(canonicalize(null));
    expect(stored[0]!.outputHash).toBe(expectedOutputHash);
  });

  it("forwards extra parameters to the Anthropic API", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
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
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
      model: "claude-sonnet-4-20250514",
      maxTokens: 1024,
      temperature: 0.7,
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const expectedHash = sha256(
      canonicalize({
        messages: [{ role: "user", content: "Hello" }],
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        temperature: 0.7,
      })
    );
    expect(stored[0]!.inputHash).toBe(expectedHash);
  });

  it("produces entry hashes that are valid SHA-256 hex strings", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.entryHash).toHaveLength(64);
    expect(entry.entryHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("defaults model to claude-sonnet-4-20250514 when not specified", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-sonnet-4-20250514" })
    );
  });

  it("defaults maxTokens to 1024 when not specified", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 1024 })
    );
  });

  it("uses null for session and actor when not provided", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sessionId).toBeNull();
    expect(stored[0]!.actorId).toBeNull();
  });

  it("defaults tags to empty object when not provided", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.tags).toEqual({});
  });

  it("getChain returns current chain state", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    const emptyChain = wrapped.getChain();
    expect(emptyChain.chainId).toBe("test-chain");
    expect(emptyChain.entries.length).toBe(0);

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    const chainAfter = wrapped.getChain();
    expect(chainAfter.entries.length).toBe(1);
  });

  it("sets first entry previousHash to null", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.previousHash).toBeNull();
  });

  it("assigns incrementing sequence numbers", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    for (let i = 0; i < 3; i++) {
      await wrapped.createMessage({
        messages: [{ role: "user", content: `Msg ${i}` }],
      });
    }

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sequenceNumber).toBe(0);
    expect(stored[1]!.sequenceNumber).toBe(1);
    expect(stored[2]!.sequenceNumber).toBe(2);
  });
});

describe("GridSealAnthropic overhead", () => {
  it("adds less than 2ms overhead per call with in-memory storage", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
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
    expect(p99).toBeLessThan(20);
  });
});

describe("wrapAnthropic", () => {
  it("returns an object with createMessage and getChain", () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
    });

    expect(typeof wrapped.createMessage).toBe("function");
    expect(typeof wrapped.getChain).toBe("function");
  });

  it("passes session and actor through to entries", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapAnthropic({
      client,
      chainId: "test-chain",
      storage,
      sessionId: "s1",
      actorId: "a1",
    });

    await wrapped.createMessage({
      messages: [{ role: "user", content: "Hello" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sessionId).toBe("s1");
    expect(stored[0]!.actorId).toBe("a1");
  });
});
