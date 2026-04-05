import { describe, it, expect, vi } from "vitest";
import type { OpenAI } from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import {
  createInMemoryAdapter,
  validateChain,
  canonicalize,
  sha256,
} from "@gridseal/core";
import { wrapOpenAI } from "../../src/adapters/openai.js";

function makeMockCompletion(overrides?: Partial<ChatCompletion>): ChatCompletion {
  return {
    id: "chatcmpl-abc123",
    object: "chat.completion",
    created: 1700000000,
    model: "gpt-4o-2024-05-13",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "Hello! How can I help you?",
          refusal: null,
        },
        finish_reason: "stop",
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: 25,
      completion_tokens: 15,
      total_tokens: 40,
    },
    ...overrides,
  };
}

function makeMockClient(
  completion?: ChatCompletion
): OpenAI & { chat: { completions: { create: ReturnType<typeof vi.fn> } } } {
  const mockCreate = vi.fn().mockResolvedValue(completion ?? makeMockCompletion());
  return {
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  } as unknown as OpenAI & { chat: { completions: { create: ReturnType<typeof vi.fn> } } };
}

describe("GridSealOpenAI", () => {
  it("captures chat completion as audit entry", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
      model: "gpt-4o",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.completion.model).toBe("gpt-4o-2024-05-13");
    expect(result.value.entryId.length).toBeGreaterThan(0);

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored.length).toBe(1);

    const entry = stored[0]!;
    expect(entry.entryType).toBe("ai_decision");
    expect(entry.modelId).toBe("gpt-4o-2024-05-13");
    expect(entry.modelProvider).toBe("openai");
    expect(entry.inputTokenCount).toBe(25);
    expect(entry.outputTokenCount).toBe(15);
    expect(entry.decisionType).toBe("generation");
  });

  it("captures input hash from messages", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    const messages = [{ role: "user" as const, content: "Hello" }];
    await wrapped.createCompletion({ messages, model: "gpt-4o" });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;

    const expectedInputHash = sha256(
      canonicalize({ messages, model: "gpt-4o" })
    );
    expect(entry.inputHash).toBe(expectedInputHash);
  });

  it("captures output hash from response content", async () => {
    const completion = makeMockCompletion({
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Test response", refusal: null },
          finish_reason: "stop",
          logprobs: null,
        },
      ],
    });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(completion);
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hi" }],
      model: "gpt-4o",
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    const expectedOutputHash = sha256(canonicalize("Test response"));
    expect(entry.outputHash).toBe(expectedOutputHash);
  });

  it("builds a valid chain from multiple calls", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    for (let i = 0; i < 5; i++) {
      const result = await wrapped.createCompletion({
        messages: [{ role: "user", content: `Message ${i}` }],
        model: "gpt-4o",
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
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
      sessionId: "session-42",
      actorId: "user-7",
    });

    await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
      model: "gpt-4o",
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.sessionId).toBe("session-42");
    expect(entry.actorId).toBe("user-7");
  });

  it("records custom tags and annotation", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
      model: "gpt-4o",
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
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createCompletion({
      messages: [{ role: "user", content: "Classify this" }],
      model: "gpt-4o",
      decisionType: "classification",
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.decisionType).toBe("classification");
  });

  it("supports parent entry ID for tree structure", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    const r1 = await wrapped.createCompletion({
      messages: [{ role: "user", content: "Root call" }],
      model: "gpt-4o",
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const rootId = r1.value.entryId;

    const r2 = await wrapped.createCompletion({
      messages: [{ role: "user", content: "Child call" }],
      model: "gpt-4o",
      parentEntryId: rootId,
    });
    expect(r2.ok).toBe(true);

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[1]!.parentEntryId).toBe(rootId);
  });

  it("returns OPENAI_API_ERROR when the API call fails", async () => {
    const client = makeMockClient();
    client.chat.completions.create.mockRejectedValue(
      new Error("Connection refused")
    );

    const storage = createInMemoryAdapter();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
      model: "gpt-4o",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("OPENAI_API_ERROR");
    expect(result.error.message).toContain("Connection refused");
  });

  it("handles null usage in response", async () => {
    const completion = makeMockCompletion();
    (completion as Record<string, unknown>).usage = undefined;
    const storage = createInMemoryAdapter();
    const client = makeMockClient(completion);
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
      model: "gpt-4o",
    });

    expect(result.ok).toBe(true);
    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.inputTokenCount).toBeNull();
    expect(stored[0]!.outputTokenCount).toBeNull();
  });

  it("handles empty choices in response", async () => {
    const completion = makeMockCompletion({ choices: [] });
    const storage = createInMemoryAdapter();
    const client = makeMockClient(completion);
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    const result = await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
      model: "gpt-4o",
    });

    expect(result.ok).toBe(true);
    const stored = await storage.getEntriesByChainId("test-chain");
    const expectedOutputHash = sha256(canonicalize(null));
    expect(stored[0]!.outputHash).toBe(expectedOutputHash);
  });

  it("forwards extra parameters to the OpenAI API", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
      model: "gpt-4o",
      temperature: 0.7,
      max_tokens: 100,
    });

    expect(client.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 0.7,
        max_tokens: 100,
      })
    );
  });

  it("includes extra parameters in input hash", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
      model: "gpt-4o",
      temperature: 0.7,
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const expectedHash = sha256(
      canonicalize({
        messages: [{ role: "user", content: "Hello" }],
        model: "gpt-4o",
        temperature: 0.7,
      })
    );
    expect(stored[0]!.inputHash).toBe(expectedHash);
  });

  it("produces entry hashes that are valid SHA-256 hex strings", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
      model: "gpt-4o",
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.entryHash).toHaveLength(64);
    expect(entry.entryHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("defaults model to gpt-4o when not specified", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(client.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o" })
    );
  });

  it("uses null for session and actor when not provided", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sessionId).toBeNull();
    expect(stored[0]!.actorId).toBeNull();
  });

  it("defaults tags to empty object when not provided", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.tags).toEqual({});
  });

  it("getChain returns current chain state", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    const emptyChain = wrapped.getChain();
    expect(emptyChain.chainId).toBe("test-chain");
    expect(emptyChain.entries.length).toBe(0);

    await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
    });

    const chainAfter = wrapped.getChain();
    expect(chainAfter.entries.length).toBe(1);
  });

  it("sets first entry previousHash to null", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.previousHash).toBeNull();
  });

  it("assigns incrementing sequence numbers", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    for (let i = 0; i < 3; i++) {
      await wrapped.createCompletion({
        messages: [{ role: "user", content: `Msg ${i}` }],
      });
    }

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sequenceNumber).toBe(0);
    expect(stored[1]!.sequenceNumber).toBe(1);
    expect(stored[2]!.sequenceNumber).toBe(2);
  });
});

describe("wrapOpenAI", () => {
  it("returns an object with createCompletion and getChain", () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
    });

    expect(typeof wrapped.createCompletion).toBe("function");
    expect(typeof wrapped.getChain).toBe("function");
  });

  it("passes session and actor through to entries", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "test-chain",
      storage,
      sessionId: "s1",
      actorId: "a1",
    });

    await wrapped.createCompletion({
      messages: [{ role: "user", content: "Hello" }],
    });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sessionId).toBe("s1");
    expect(stored[0]!.actorId).toBe("a1");
  });
});

describe("GridSealOpenAI overhead", () => {
  it("adds less than 2ms overhead per call with in-memory storage", async () => {
    const storage = createInMemoryAdapter();
    const client = makeMockClient();
    const wrapped = wrapOpenAI({
      client,
      chainId: "bench-chain",
      storage,
    });

    // Warm up
    for (let i = 0; i < 10; i++) {
      await wrapped.createCompletion({
        messages: [{ role: "user", content: `Warmup ${i}` }],
      });
    }

    // Measure 200 calls (p99 at index 198, tolerates 2 outliers)
    const times: number[] = [];
    for (let i = 0; i < 200; i++) {
      const start = performance.now();
      await wrapped.createCompletion({
        messages: [{ role: "user", content: `Bench ${i}` }],
      });
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p99 = times[Math.floor(times.length * 0.99)]!;
    expect(p99).toBeLessThan(2);
  });
});
