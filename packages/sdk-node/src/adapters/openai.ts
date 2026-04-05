/**
 * OpenAI SDK wrapper that auto-captures AI decisions into a GridSeal proof chain.
 *
 * Requires the `openai` package as a peer dependency.
 */

import { randomUUID } from "node:crypto";
import type { OpenAI } from "openai";
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
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

/** Result of a wrapped OpenAI call, containing both the response and the audit entry ID. */
export type CapturedCompletion = {
  readonly completion: ChatCompletion;
  readonly entryId: string;
};

/** Error from the capture/audit process (the OpenAI call itself may have succeeded). */
export type CaptureError = {
  readonly type: "OPENAI_API_ERROR" | "CHAIN_APPEND_ERROR" | "STORAGE_ERROR";
  readonly message: string;
};

/** Options for creating a GridSealOpenAI wrapper. */
export type GridSealOpenAIOptions = {
  readonly client: OpenAI;
  readonly chainId: string;
  readonly storage: StorageAdapter;
  readonly sessionId?: string | null;
  readonly actorId?: string | null;
};

/** Options for a single completion call. */
export type CreateCompletionOptions = {
  readonly messages: ReadonlyArray<ChatCompletionCreateParamsNonStreaming["messages"][number]>;
  readonly model?: string;
  readonly decisionType?: DecisionType | null;
  readonly tags?: Readonly<Record<string, string>>;
  readonly annotation?: string | null;
  readonly parentEntryId?: string | null;
} & Omit<ChatCompletionCreateParamsNonStreaming, "messages" | "model" | "stream">;

/** Wraps an OpenAI client to auto-capture chat completions into a proof chain. */
export type GridSealOpenAI = {
  /** Make an OpenAI chat completion call and auto-capture an audit entry. */
  readonly createCompletion: (
    options: CreateCompletionOptions
  ) => Promise<Result<CapturedCompletion, CaptureError>>;
  /** Access the current chain state. */
  readonly getChain: () => ChainState;
};

function extractCompletionData(completion: ChatCompletion): {
  content: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
} {
  let content: string | null = null;
  if (completion.choices.length > 0) {
    const firstChoice = completion.choices[0];
    if (firstChoice !== undefined) {
      content = firstChoice.message.content;
    }
  }

  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  if (completion.usage !== undefined) {
    inputTokens = completion.usage.prompt_tokens;
    outputTokens = completion.usage.completion_tokens;
  }

  return { content, inputTokens, outputTokens };
}

function generateEntryId(): string {
  return randomUUID();
}

/** Create a GridSealOpenAI wrapper around an OpenAI client. */
export function wrapOpenAI(options: GridSealOpenAIOptions): GridSealOpenAI {
  const {
    client,
    chainId,
    storage,
    sessionId = null,
    actorId = null,
  } = options;

  let chain: ChainState = createChain(chainId);

  const createCompletion = async (
    callOptions: CreateCompletionOptions
  ): Promise<Result<CapturedCompletion, CaptureError>> => {
    const {
      messages,
      model = "gpt-4o",
      decisionType = "generation",
      tags,
      annotation = null,
      parentEntryId = null,
      ...extraParams
    } = callOptions;

    const inputPayload: Record<string, unknown> = {
      messages,
      model,
      ...extraParams,
    };
    const inputHash = sha256(canonicalize(inputPayload));

    let completion: ChatCompletion;
    try {
      completion = await client.chat.completions.create({
        model,
        messages: [...messages],
        ...extraParams,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return err({ type: "OPENAI_API_ERROR", message });
    }

    const outputData = extractCompletionData(completion);
    const outputHash = sha256(canonicalize(outputData.content));

    const entryId = generateEntryId();
    const timestamp = new Date().toISOString();

    const entryInput: AppendEntryInput = {
      entryId,
      timestamp,
      entryType: "ai_decision",
      parentEntryId,
      modelId: completion.model,
      modelProvider: "openai",
      inputHash,
      outputHash,
      inputTokenCount: outputData.inputTokens,
      outputTokenCount: outputData.outputTokens,
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

    return ok({ completion, entryId });
  };

  const getChain = (): ChainState => chain;

  return { createCompletion, getChain };
}
