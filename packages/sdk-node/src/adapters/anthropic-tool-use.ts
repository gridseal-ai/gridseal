/**
 * Anthropic Tool Use adapter that captures tool_use content blocks as
 * separate audit entries in a GridSeal proof chain.
 *
 * Extends the standard Anthropic adapter by creating child entries for each
 * tool_use block in the response, in addition to the main message entry.
 *
 * Requires the `@anthropic-ai/sdk` package as a peer dependency.
 */

import { randomUUID } from "node:crypto";
import type { Anthropic } from "@anthropic-ai/sdk";
import type {
  Message,
  TextBlock,
  ToolUseBlock,
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

/** A captured tool_use block with its audit entry ID. */
export type CapturedToolUse = {
  readonly toolUseId: string;
  readonly toolName: string;
  readonly input: unknown;
  readonly entryId: string;
};

/** Result of a wrapped Anthropic call with tool use capture. */
export type CapturedToolUseMessage = {
  readonly message: Message;
  readonly entryId: string;
  readonly toolUseEntries: ReadonlyArray<CapturedToolUse>;
};

/** Error from the capture/audit process. */
export type ToolUseCaptureError = {
  readonly type: "ANTHROPIC_API_ERROR" | "CHAIN_APPEND_ERROR" | "STORAGE_ERROR";
  readonly message: string;
};

/** Options for creating a GridSealAnthropicToolUse wrapper. */
export type GridSealAnthropicToolUseOptions = {
  readonly client: Anthropic;
  readonly chainId: string;
  readonly storage: StorageAdapter;
  readonly sessionId?: string | null;
  readonly actorId?: string | null;
};

/** Options for a single message call with tool use capture. */
export type CreateToolUseMessageOptions = {
  readonly messages: ReadonlyArray<MessageCreateParamsNonStreaming["messages"][number]>;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly decisionType?: DecisionType | null;
  readonly tags?: Readonly<Record<string, string>>;
  readonly annotation?: string | null;
  readonly parentEntryId?: string | null;
} & Omit<MessageCreateParamsNonStreaming, "messages" | "model" | "max_tokens" | "stream">;

/** Wraps an Anthropic client to capture both messages and tool_use blocks. */
export type GridSealAnthropicToolUse = {
  /** Make an Anthropic messages API call and capture audit entries for the message and each tool_use block. */
  readonly createMessage: (
    options: CreateToolUseMessageOptions
  ) => Promise<Result<CapturedToolUseMessage, ToolUseCaptureError>>;
  /** Access the current chain state. */
  readonly getChain: () => ChainState;
};

function isToolUseBlock(block: ContentBlock): block is ToolUseBlock {
  return block.type === "tool_use";
}

function extractTextContent(message: Message): string | null {
  const textBlocks = message.content.filter(
    (block: ContentBlock): block is TextBlock => block.type === "text"
  );
  if (textBlocks.length === 0) {
    return null;
  }
  if (textBlocks.length === 1) {
    return textBlocks[0]!.text;
  }
  return textBlocks.map((b) => b.text).join("\n");
}

function extractTokenCounts(message: Message): {
  inputTokens: number | null;
  outputTokens: number | null;
} {
  if (message.usage !== undefined && message.usage !== null) {
    return {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  }
  return { inputTokens: null, outputTokens: null };
}

function generateEntryId(): string {
  return randomUUID();
}

/** Create a GridSealAnthropicToolUse wrapper around an Anthropic client. */
export function wrapAnthropicToolUse(
  options: GridSealAnthropicToolUseOptions
): GridSealAnthropicToolUse {
  const {
    client,
    chainId,
    storage,
    sessionId = null,
    actorId = null,
  } = options;

  let chain: ChainState = createChain(chainId);

  const createMessage = async (
    callOptions: CreateToolUseMessageOptions
  ): Promise<Result<CapturedToolUseMessage, ToolUseCaptureError>> => {
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

    const textContent = extractTextContent(response);
    const outputHash = sha256(canonicalize(textContent));
    const tokenCounts = extractTokenCounts(response);

    const messageEntryId = generateEntryId();
    const timestamp = new Date().toISOString();

    const entryInput: AppendEntryInput = {
      entryId: messageEntryId,
      timestamp,
      entryType: "ai_decision",
      parentEntryId,
      modelId: response.model,
      modelProvider: "anthropic",
      inputHash,
      outputHash,
      inputTokenCount: tokenCounts.inputTokens,
      outputTokenCount: tokenCounts.outputTokens,
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
        message: `Failed to append message entry: ${JSON.stringify(appendResult.error)}`,
      });
    }

    chain = appendResult.value.chain;
    const entry: ProofChainEntry = appendResult.value.entry;

    const storeResult: Result<ProofChainEntry, StorageError> =
      await storage.putEntry(entry);
    if (!storeResult.ok) {
      return err({
        type: "STORAGE_ERROR",
        message: `Failed to store message entry: ${JSON.stringify(storeResult.error)}`,
      });
    }

    const toolUseBlocks = response.content.filter(isToolUseBlock);
    const toolUseEntries: CapturedToolUse[] = [];

    for (const block of toolUseBlocks) {
      const toolEntryId = generateEntryId();
      const toolTimestamp = new Date().toISOString();

      const toolInputPayload: Record<string, unknown> = {
        tool_use_id: block.id,
        name: block.name,
        input: block.input,
      };
      const toolInputHash = sha256(canonicalize(toolInputPayload));
      const toolOutputHash = sha256(canonicalize({
        tool_use_id: block.id,
        name: block.name,
      }));

      const toolEntryInput: AppendEntryInput = {
        entryId: toolEntryId,
        timestamp: toolTimestamp,
        entryType: "ai_decision",
        parentEntryId: messageEntryId,
        modelId: block.name,
        modelProvider: "anthropic",
        inputHash: toolInputHash,
        outputHash: toolOutputHash,
        inputTokenCount: null,
        outputTokenCount: null,
        decisionType: "tool_call",
        sessionId,
        actorId,
        tags: tags ?? {},
        annotation: null,
      };

      const toolAppendResult = appendEntry(chain, toolEntryInput);
      if (!toolAppendResult.ok) {
        return err({
          type: "CHAIN_APPEND_ERROR",
          message: `Failed to append tool_use entry for ${block.name}: ${JSON.stringify(toolAppendResult.error)}`,
        });
      }

      chain = toolAppendResult.value.chain;
      const toolEntry: ProofChainEntry = toolAppendResult.value.entry;

      const toolStoreResult: Result<ProofChainEntry, StorageError> =
        await storage.putEntry(toolEntry);
      if (!toolStoreResult.ok) {
        return err({
          type: "STORAGE_ERROR",
          message: `Failed to store tool_use entry for ${block.name}: ${JSON.stringify(toolStoreResult.error)}`,
        });
      }

      toolUseEntries.push({
        toolUseId: block.id,
        toolName: block.name,
        input: block.input,
        entryId: toolEntryId,
      });
    }

    return ok({
      message: response,
      entryId: messageEntryId,
      toolUseEntries,
    });
  };

  const getChain = (): ChainState => chain;

  return { createMessage, getChain };
}
