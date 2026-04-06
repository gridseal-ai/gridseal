import { describe, it, expect, vi } from "vitest";
import {
  createInMemoryAdapter,
  validateChain,
  canonicalize,
  sha256,
} from "@gridseal/core";
import { wrapCrew } from "../../src/frameworks/crew.js";

type TaskInput = {
  readonly query: string;
};

type TaskOutput = {
  readonly answer: string;
  readonly confidence: number;
};

function makeMockTaskFn(): (
  input: TaskInput
) => Promise<TaskOutput> {
  return vi.fn().mockImplementation(async (input: TaskInput) => ({
    answer: `Result for: ${input.query}`,
    confidence: 0.95,
  }));
}

describe("GridSealCrew", () => {
  it("captures task execution as audit entry", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();
    const wrappedTask = wrapped.wrapTask("research", taskFn, {
      agentRole: "researcher",
    });

    const result = await wrappedTask({ query: "AI safety" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.output.answer).toBe("Result for: AI safety");
    expect(result.value.output.confidence).toBe(0.95);
    expect(result.value.entryId.length).toBeGreaterThan(0);

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored.length).toBe(1);

    const entry = stored[0]!;
    expect(entry.entryType).toBe("ai_decision");
    expect(entry.modelId).toBe("researcher");
    expect(entry.modelProvider).toBe("crew");
    expect(entry.decisionType).toBe("generation");
    expect(entry.inputTokenCount).toBeNull();
    expect(entry.outputTokenCount).toBeNull();
  });

  it("passes input to the underlying task function", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();
    const wrappedTask = wrapped.wrapTask("analyze", taskFn, {
      agentRole: "analyst",
    });

    const input: TaskInput = { query: "market trends" };
    await wrappedTask(input);

    expect(taskFn).toHaveBeenCalledWith(input);
  });

  it("captures input hash including task name and agent role", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();
    const wrappedTask = wrapped.wrapTask("research", taskFn, {
      agentRole: "researcher",
    });

    const input: TaskInput = { query: "AI safety" };
    await wrappedTask(input);

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;

    const expectedInputHash = sha256(
      canonicalize({
        task: "research",
        agentRole: "researcher",
        input,
      })
    );
    expect(entry.inputHash).toBe(expectedInputHash);
  });

  it("captures output hash from task output", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();
    const wrappedTask = wrapped.wrapTask("research", taskFn, {
      agentRole: "researcher",
    });

    await wrappedTask({ query: "AI safety" });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;

    const expectedOutput: TaskOutput = {
      answer: "Result for: AI safety",
      confidence: 0.95,
    };
    const expectedOutputHash = sha256(canonicalize(expectedOutput));
    expect(entry.outputHash).toBe(expectedOutputHash);
  });

  it("sets modelId to agent role", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();

    const task1 = wrapped.wrapTask("research", taskFn, {
      agentRole: "researcher",
    });
    const task2 = wrapped.wrapTask("write", taskFn, {
      agentRole: "writer",
    });

    await task1({ query: "data" });
    await task2({ query: "report" });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.modelId).toBe("researcher");
    expect(stored[1]!.modelId).toBe("writer");
  });

  it("includes agentRole and taskName in tags", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();
    const wrappedTask = wrapped.wrapTask("research", taskFn, {
      agentRole: "researcher",
    });
    await wrappedTask({ query: "AI" });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.tags).toEqual(
      expect.objectContaining({
        agentRole: "researcher",
        taskName: "research",
      })
    );
  });

  it("merges custom tags with agent role and task name", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();
    const wrappedTask = wrapped.wrapTask("research", taskFn, {
      agentRole: "researcher",
      tags: { env: "prod", priority: "high" },
    });
    await wrappedTask({ query: "AI" });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.tags).toEqual({
      env: "prod",
      priority: "high",
      agentRole: "researcher",
      taskName: "research",
    });
  });

  it("builds a valid chain from multiple task executions", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();

    for (let i = 0; i < 5; i++) {
      const task = wrapped.wrapTask(`task_${i}`, taskFn, {
        agentRole: `agent_${i}`,
      });
      const result = await task({ query: `query_${i}` });
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
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
      sessionId: "crew-session-1",
      actorId: "crew-orchestrator",
    });

    const taskFn = makeMockTaskFn();
    const wrappedTask = wrapped.wrapTask("research", taskFn, {
      agentRole: "researcher",
    });
    await wrappedTask({ query: "test" });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.sessionId).toBe("crew-session-1");
    expect(entry.actorId).toBe("crew-orchestrator");
  });

  it("records annotation", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();
    const wrappedTask = wrapped.wrapTask("summarize", taskFn, {
      agentRole: "summarizer",
      annotation: "Final summary step",
    });
    await wrappedTask({ query: "all findings" });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.annotation).toBe("Final summary step");
  });

  it("supports custom decision type", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();
    const wrappedTask = wrapped.wrapTask("classify", taskFn, {
      agentRole: "classifier",
      decisionType: "classification",
    });
    await wrappedTask({ query: "categorize this" });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.decisionType).toBe("classification");
  });

  it("supports parent entry ID for tree structure", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();

    const planTask = wrapped.wrapTask("plan", taskFn, {
      agentRole: "planner",
    });
    const r1 = await planTask({ query: "plan project" });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const planId = r1.value.entryId;

    const execTask = wrapped.wrapTask("execute", taskFn, {
      agentRole: "executor",
      parentEntryId: planId,
    });
    const r2 = await execTask({ query: "do step 1" });
    expect(r2.ok).toBe(true);

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[1]!.parentEntryId).toBe(planId);
  });

  it("returns TASK_EXECUTION_ERROR when the task function fails", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const failingTask = vi
      .fn()
      .mockRejectedValue(new Error("Agent context window exceeded"));
    const wrappedTask = wrapped.wrapTask("failing", failingTask, {
      agentRole: "broken-agent",
    });

    const result = await wrappedTask({ query: "too much data" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("TASK_EXECUTION_ERROR");
    expect(result.error.message).toContain("Agent context window exceeded");
  });

  it("uses custom model provider when specified", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
      modelProvider: "custom-crew",
    });

    const taskFn = makeMockTaskFn();
    const wrappedTask = wrapped.wrapTask("research", taskFn, {
      agentRole: "researcher",
    });
    await wrappedTask({ query: "test" });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.modelProvider).toBe("custom-crew");
  });

  it("uses null for session and actor when not provided", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();
    const wrappedTask = wrapped.wrapTask("research", taskFn, {
      agentRole: "researcher",
    });
    await wrappedTask({ query: "test" });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sessionId).toBeNull();
    expect(stored[0]!.actorId).toBeNull();
  });

  it("produces entry hashes that are valid SHA-256 hex strings", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();
    const wrappedTask = wrapped.wrapTask("research", taskFn, {
      agentRole: "researcher",
    });
    await wrappedTask({ query: "test" });

    const stored = await storage.getEntriesByChainId("test-chain");
    const entry = stored[0]!;
    expect(entry.entryHash).toHaveLength(64);
    expect(entry.entryHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("getChain returns current chain state", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const emptyChain = wrapped.getChain();
    expect(emptyChain.chainId).toBe("test-chain");
    expect(emptyChain.entries.length).toBe(0);

    const taskFn = makeMockTaskFn();
    const wrappedTask = wrapped.wrapTask("research", taskFn, {
      agentRole: "researcher",
    });
    await wrappedTask({ query: "test" });

    const chainAfter = wrapped.getChain();
    expect(chainAfter.entries.length).toBe(1);
  });

  it("sets first entry previousHash to null", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();
    const wrappedTask = wrapped.wrapTask("research", taskFn, {
      agentRole: "researcher",
    });
    await wrappedTask({ query: "test" });

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.previousHash).toBeNull();
  });

  it("assigns incrementing sequence numbers", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const taskFn = makeMockTaskFn();
    for (let i = 0; i < 3; i++) {
      const task = wrapped.wrapTask(`task_${i}`, taskFn, {
        agentRole: `agent_${i}`,
      });
      await task({ query: `q_${i}` });
    }

    const stored = await storage.getEntriesByChainId("test-chain");
    expect(stored[0]!.sequenceNumber).toBe(0);
    expect(stored[1]!.sequenceNumber).toBe(1);
    expect(stored[2]!.sequenceNumber).toBe(2);
  });

  it("handles null output from task function", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    const nullTask = vi.fn().mockResolvedValue(null);
    const wrappedTask = wrapped.wrapTask("null_task", nullTask, {
      agentRole: "null-agent",
    });
    const result = await wrappedTask({ query: "test" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.output).toBeNull();

    const stored = await storage.getEntriesByChainId("test-chain");
    const expectedOutputHash = sha256(canonicalize(null));
    expect(stored[0]!.outputHash).toBe(expectedOutputHash);
  });

  it("simulates a multi-agent crew workflow", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "crew-workflow",
      storage,
      sessionId: "crew-session-1",
    });

    const researchFn = vi.fn().mockResolvedValue({
      findings: ["finding 1", "finding 2"],
    });
    const writeFn = vi.fn().mockResolvedValue({
      draft: "Based on findings...",
    });
    const reviewFn = vi.fn().mockResolvedValue({
      approved: true,
      feedback: "Looks good",
    });

    const research = wrapped.wrapTask("gather_data", researchFn, {
      agentRole: "researcher",
    });
    const write = wrapped.wrapTask("write_report", writeFn, {
      agentRole: "writer",
    });
    const review = wrapped.wrapTask("review_report", reviewFn, {
      agentRole: "reviewer",
    });

    const r1 = await research({ query: "AI governance" });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    const r2 = await write({ query: "write report" });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    const r3 = await review({ query: "review draft" });
    expect(r3.ok).toBe(true);

    const chain = wrapped.getChain();
    expect(chain.entries.length).toBe(3);

    const validation = validateChain(chain);
    expect(validation.ok).toBe(true);

    const stored = await storage.getEntriesByChainId("crew-workflow");
    expect(stored[0]!.tags).toEqual(
      expect.objectContaining({ agentRole: "researcher" })
    );
    expect(stored[1]!.tags).toEqual(
      expect.objectContaining({ agentRole: "writer" })
    );
    expect(stored[2]!.tags).toEqual(
      expect.objectContaining({ agentRole: "reviewer" })
    );
  });
});

describe("wrapCrew", () => {
  it("returns an object with wrapTask and getChain", () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "test-chain",
      storage,
    });

    expect(typeof wrapped.wrapTask).toBe("function");
    expect(typeof wrapped.getChain).toBe("function");
  });
});

describe("GridSealCrew overhead", () => {
  it("adds less than 2ms overhead per task execution with in-memory storage", async () => {
    const storage = createInMemoryAdapter();
    const wrapped = wrapCrew({
      chainId: "bench-chain",
      storage,
    });

    const fastTask = vi.fn().mockResolvedValue({ result: "ok" });

    // Warm up
    for (let i = 0; i < 5; i++) {
      const task = wrapped.wrapTask(`warmup_${i}`, fastTask, {
        agentRole: `agent_${i}`,
      });
      await task({ step: i });
    }

    // Measure
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const task = wrapped.wrapTask(`bench_task_${i}`, fastTask, {
        agentRole: `bench_agent_${i}`,
      });
      const start = performance.now();
      await task({ step: i });
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p99 = times[Math.floor(times.length * 0.99)]!;
    expect(p99).toBeLessThan(20);
  });
});
