/**
 * Anthropic SDK wrapper that auto-captures AI decisions into a GridSeal proof chain.
 *
 * Requires the `@anthropic-ai/sdk` package as a peer dependency.
 */

import { randomUUID } from "node:crypto";
import type { Anthropic } from "@anthropic-ai/sdk";
import type {
  Message,
  TextBlock,
  ContentBlock,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/messages/messages";
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

/** Result of a wrapped Anthropic call, containing both the response and the audit entry ID. */
export type CapturedMessage = {
  readonly message: Message;
  readonly entryId: string;
};

/** Error from the capture/audit process (the Anthropic call itself may have succeeded). */
export type CaptureError = {
  readonly type: "ANTHROPIC_API_ERROR" | "CHAIN_APPEND_ERROR" | "STORAGE_ERROR";
  readonly message: string;
};

/** Options for creating a GridSealAnthropic wrapper. */
export type GridSealAnthropicOptions = {
  readonly client: Anthropic;
  readonly chainId: string;
  readonly storage: StorageAdapter;
  readonly sessionId?: string | null;
  readonly actorId?: string | null;
};

/** Options for a single message call. */
export type CreateMessageOptions = {
  readonly messages: ReadonlyArray<MessageCreateParamsNonStreaming["messages"][number]>;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly decisionType?: DecisionType | null;
  readonly tags?: Readonly<Record<string, string>>;
  readonly annotation?: string | null;
  readonly parentEntryId?: string | null;
} & Omit<MessageCreateParamsNonStreaming, "messages" | "model" | "max_tokens" | "stream">;

/** Wraps an Anthropic client to auto-capture message completions into a proof chain. */
export type GridSealAnthropic = {
  /** Make an Anthropic messages API call and auto-capture an audit entry. */
  readonly createMessage: (
    options: CreateMessageOptions
  ) => Promise<Result<CapturedMessage, CaptureError>>;
  /** Access the current chain state. */
  readonly getChain: () => ChainState;
};

function extractMessageData(message: Message): {
  content: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
} {
  let content: string | null = null;
  if (message.content.length > 0) {
    const textBlocks = message.content.filter(
      (block: ContentBlock): block is TextBlock => block.type === "text"
    );
    if (textBlocks.length === 1) {
      content = textBlocks[0]!.text;
    } else if (textBlocks.length > 1) {
      content = textBlocks.map((b) => b.text).join("\n");
    }
  }

  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  if (message.usage !== undefined && message.usage !== null) {
    inputTokens = message.usage.input_tokens;
    outputTokens = message.usage.output_tokens;
  }

  return { content, inputTokens, outputTokens };
}

function generateEntryId(): string {
  return randomUUID();
}

/** Create a GridSealAnthropic wrapper around an Anthropic client. */
export function wrapAnthropic(options: GridSealAnthropicOptions): GridSealAnthropic {
  const {
    client,
    chainId,
    storage,
    sessionId = null,
    actorId = null,
  } = options;

  let chain: ChainState = createChain(chainId);

  const createMessage = async (
    callOptions: CreateMessageOptions
  ): Promise<Result<CapturedMessage, CaptureError>> => {
    const {
      messages,
      model = "claude-sonnet-4-20250514",
      maxTokens = 1024,
      decisionType = "generation",
      tags,
      annotation = null,
      parentEntryId = null,
      ...extraParams
    } = callOptions;

    const inputPayload: Record<string, unknown> = {
      messages,
      model,
      max_tokens: maxTokens,
      ...extraParams,
    };
    const inputHash = sha256(canonicalize(inputPayload));

    let response: Message;
    try {
      response = await client.messages.create({
        model,
        messages: [...messages],
        max_tokens: maxTokens,
        ...extraParams,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return err({ type: "ANTHROPIC_API_ERROR", message });
    }

    const outputData = extractMessageData(response);
    const outputHash = sha256(canonicalize(outputData.content));

    const entryId = generateEntryId();
    const timestamp = new Date().toISOString();

    const entryInput: AppendEntryInput = {
      entryId,
      timestamp,
      entryType: "ai_decision",
      parentEntryId,
      modelId: response.model,
      modelProvider: "anthropic",
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

    return ok({ message: response, entryId });
  };

  const getChain = (): ChainState => chain;

  return { createMessage, getChain };
}
