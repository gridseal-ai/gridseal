/**
 * CrewAI-style framework adapter that auto-captures agent task executions
 * into a GridSeal proof chain.
 *
 * Wraps agent task functions to create audit entries for each task execution
 * in a multi-agent crew workflow, recording agent role, task inputs/outputs,
 * and task metadata.
 */

import { randomUUID } from "node:crypto";
import {
  type AppendEntryInput,
  type ChainState,
  type DecisionType,
  type ProofChainEntry,
  type Result,
  type StorageAdapter,
  type StorageError,
  appendEntry,
  canonicalize,
  createChain,
  ok,
  err,
  sha256,
} from "@gridseal/core";

/** Result of a wrapped crew task execution. */
export type CapturedTaskResult<TOutput> = {
  readonly output: TOutput;
  readonly entryId: string;
};

/** Error from the capture/audit process (the task function itself may have succeeded). */
export type CrewCaptureError = {
  readonly type:
    | "TASK_EXECUTION_ERROR"
    | "CHAIN_APPEND_ERROR"
    | "STORAGE_ERROR";
  readonly message: string;
};

/** Options for creating a GridSealCrew wrapper. */
export type GridSealCrewOptions = {
  readonly chainId: string;
  readonly storage: StorageAdapter;
  readonly modelProvider?: string;
  readonly sessionId?: string | null;
  readonly actorId?: string | null;
};

/** Options for wrapping an individual task function. */
export type WrapTaskOptions = {
  readonly agentRole: string;
  readonly decisionType?: DecisionType | null;
  readonly tags?: Readonly<Record<string, string>>;
  readonly annotation?: string | null;
  readonly parentEntryId?: string | null;
};

/** Wraps a crew workflow to auto-capture agent task executions into a proof chain. */
export type GridSealCrew = {
  /**
   * Wrap a task function to auto-capture its execution as an audit entry.
   * The agent role is recorded as part of the entry metadata (modelId).
   */
  readonly wrapTask: <TInput, TOutput>(
    taskName: string,
    fn: (input: TInput) => Promise<TOutput>,
    options: WrapTaskOptions
  ) => (
    input: TInput
  ) => Promise<Result<CapturedTaskResult<TOutput>, CrewCaptureError>>;
  /** Access the current chain state. */
  readonly getChain: () => ChainState;
};

function generateEntryId(): string {
  return randomUUID();
}

/** Create a GridSealCrew wrapper for capturing agent task executions. */
export function wrapCrew(options: GridSealCrewOptions): GridSealCrew {
  const {
    chainId,
    storage,
    modelProvider = "crew",
    sessionId = null,
    actorId = null,
  } = options;

  let chain: ChainState = createChain(chainId);

  const wrapTask = <TInput, TOutput>(
    taskName: string,
    fn: (input: TInput) => Promise<TOutput>,
    taskOptions: WrapTaskOptions
  ): ((
    input: TInput
  ) => Promise<
    Result<CapturedTaskResult<TOutput>, CrewCaptureError>
  >) => {
    const {
      agentRole,
      decisionType = "generation",
      tags,
      annotation = null,
      parentEntryId = null,
    } = taskOptions;

    return async (
      input: TInput
    ): Promise<
      Result<CapturedTaskResult<TOutput>, CrewCaptureError>
    > => {
      const inputPayload: Record<string, unknown> = {
        task: taskName,
        agentRole,
        input: input as unknown,
      };
      const inputHash = sha256(canonicalize(inputPayload));

      let output: TOutput;
      try {
        output = await fn(input);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        return err({ type: "TASK_EXECUTION_ERROR", message });
      }

      const outputHash = sha256(canonicalize(output));

      const entryId = generateEntryId();
      const timestamp = new Date().toISOString();

      const mergedTags: Record<string, string> = {
        ...(tags ?? {}),
        agentRole,
        taskName,
      };

      const entryInput: AppendEntryInput = {
        entryId,
        timestamp,
        entryType: "ai_decision",
        parentEntryId,
        modelId: agentRole,
        modelProvider,
        inputHash,
        outputHash,
        inputTokenCount: null,
        outputTokenCount: null,
        decisionType,
        sessionId,
        actorId,
        tags: mergedTags,
        annotation,
      };

      const appendResult = appendEntry(chain, entryInput);
      if (!appendResult.ok) {
        return err({
          type: "CHAIN_APPEND_ERROR",
          message: `Failed to append entry: ${JSON.stringify(appendResult.error)}`,
        });
      }

      chain = appendResult.value.chain;
      const entry: ProofChainEntry = appendResult.value.entry;

      const storeResult: Result<ProofChainEntry, StorageError> =
        await storage.putEntry(entry);
      if (!storeResult.ok) {
        return err({
          type: "STORAGE_ERROR",
          message: `Failed to store entry: ${JSON.stringify(storeResult.error)}`,
        });
      }

      return ok({ output, entryId });
    };
  };

  const getChain = (): ChainState => chain;

  return { wrapTask, getChain };
}
