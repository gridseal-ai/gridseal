/**
 * LangGraph framework adapter that auto-captures graph node executions
 * into a GridSeal proof chain.
 *
 * Wraps individual node functions to create audit entries for each step
 * in a LangGraph workflow, recording inputs, outputs, and node metadata.
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

/** Result of a wrapped LangGraph node execution. */
export type CapturedNodeResult<TOutput> = {
  readonly output: TOutput;
  readonly entryId: string;
};

/** Error from the capture/audit process (the node function itself may have succeeded). */
export type LangGraphCaptureError = {
  readonly type:
    | "NODE_EXECUTION_ERROR"
    | "CHAIN_APPEND_ERROR"
    | "STORAGE_ERROR";
  readonly message: string;
};

/** Options for creating a GridSealLangGraph wrapper. */
export type GridSealLangGraphOptions = {
  readonly chainId: string;
  readonly storage: StorageAdapter;
  readonly modelProvider?: string;
  readonly sessionId?: string | null;
  readonly actorId?: string | null;
};

/** Options for wrapping an individual node function. */
export type WrapNodeOptions = {
  readonly decisionType?: DecisionType | null;
  readonly tags?: Readonly<Record<string, string>>;
  readonly annotation?: string | null;
  readonly parentEntryId?: string | null;
};

/** Wraps a LangGraph workflow to auto-capture node executions into a proof chain. */
export type GridSealLangGraph = {
  /**
   * Wrap a LangGraph node function to auto-capture its execution as an audit entry.
   * The returned function has the same input/output signature but returns a Result
   * containing both the original output and the entry ID.
   */
  readonly wrapNode: <TInput, TOutput>(
    name: string,
    fn: (input: TInput) => Promise<TOutput>,
    options?: WrapNodeOptions
  ) => (
    input: TInput
  ) => Promise<Result<CapturedNodeResult<TOutput>, LangGraphCaptureError>>;
  /** Access the current chain state. */
  readonly getChain: () => ChainState;
};

function generateEntryId(): string {
  return randomUUID();
}

/** Create a GridSealLangGraph wrapper for capturing LangGraph node executions. */
export function wrapLangGraph(
  options: GridSealLangGraphOptions
): GridSealLangGraph {
  const {
    chainId,
    storage,
    modelProvider = "langgraph",
    sessionId = null,
    actorId = null,
  } = options;

  let chain: ChainState = createChain(chainId);

  const wrapNode = <TInput, TOutput>(
    name: string,
    fn: (input: TInput) => Promise<TOutput>,
    nodeOptions?: WrapNodeOptions
  ): ((
    input: TInput
  ) => Promise<
    Result<CapturedNodeResult<TOutput>, LangGraphCaptureError>
  >) => {
    const {
      decisionType = "generation",
      tags,
      annotation = null,
      parentEntryId = null,
    } = nodeOptions ?? {};

    return async (
      input: TInput
    ): Promise<
      Result<CapturedNodeResult<TOutput>, LangGraphCaptureError>
    > => {
      const inputHash = sha256(canonicalize(input));

      let output: TOutput;
      try {
        output = await fn(input);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        return err({ type: "NODE_EXECUTION_ERROR", message });
      }

      const outputHash = sha256(canonicalize(output));

      const entryId = generateEntryId();
      const timestamp = new Date().toISOString();

      const entryInput: AppendEntryInput = {
        entryId,
        timestamp,
        entryType: "ai_decision",
        parentEntryId,
        modelId: name,
        modelProvider,
        inputHash,
        outputHash,
        inputTokenCount: null,
        outputTokenCount: null,
        decisionType,
        sessionId,
        actorId,
        tags: tags ?? {},
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

  return { wrapNode, getChain };
}
