/**
 * MCP (Model Context Protocol) interceptor middleware that auto-captures
 * tool calls into a GridSeal proof chain.
 *
 * Wraps an MCP client's callTool function to create audit entries for every
 * tool invocation, recording tool name, arguments, results, and error status.
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

/** A single content block in an MCP tool result. */
export type McpContentBlock = {
  readonly type: string;
  readonly text?: string;
  readonly [key: string]: unknown;
};

/** Parameters for an MCP tool call, matching the MCP protocol shape. */
export type McpToolCallParams = {
  readonly name: string;
  readonly arguments?: Readonly<Record<string, unknown>>;
};

/** Result of an MCP tool call, matching the MCP protocol shape. */
export type McpToolResult = {
  readonly content: ReadonlyArray<McpContentBlock>;
  readonly isError?: boolean;
};

/** Function signature for an MCP client's callTool method. */
export type McpCallToolFn = (
  params: McpToolCallParams
) => Promise<McpToolResult>;

/** Result of a wrapped MCP tool call, containing both the result and the audit entry ID. */
export type CapturedToolCall = {
  readonly result: McpToolResult;
  readonly entryId: string;
};

/** Error from the capture/audit process (the MCP call itself may have succeeded). */
export type McpCaptureError = {
  readonly type: "MCP_CALL_ERROR" | "CHAIN_APPEND_ERROR" | "STORAGE_ERROR";
  readonly message: string;
};

/** Options for creating a GridSealMcp interceptor. */
export type GridSealMcpOptions = {
  readonly callTool: McpCallToolFn;
  readonly chainId: string;
  readonly storage: StorageAdapter;
  readonly modelProvider?: string;
  readonly sessionId?: string | null;
  readonly actorId?: string | null;
};

/** Options for a single intercepted tool call. */
export type InterceptCallOptions = {
  readonly name: string;
  readonly arguments?: Readonly<Record<string, unknown>>;
  readonly decisionType?: DecisionType | null;
  readonly tags?: Readonly<Record<string, string>>;
  readonly annotation?: string | null;
  readonly parentEntryId?: string | null;
};

/** Wraps an MCP client's callTool to auto-capture tool calls into a proof chain. */
export type GridSealMcp = {
  /** Call an MCP tool and auto-capture an audit entry. */
  readonly callTool: (
    options: InterceptCallOptions
  ) => Promise<Result<CapturedToolCall, McpCaptureError>>;
  /** Access the current chain state. */
  readonly getChain: () => ChainState;
};

function generateEntryId(): string {
  return randomUUID();
}

function extractTextContent(result: McpToolResult): string | null {
  const textBlocks = result.content.filter(
    (block): block is McpContentBlock & { text: string } =>
      block.type === "text" && typeof block.text === "string"
  );
  if (textBlocks.length === 0) {
    return null;
  }
  return textBlocks.map((block) => block.text).join("\n");
}

/** Create a GridSealMcp interceptor around an MCP client's callTool function. */
export function wrapMcpClient(options: GridSealMcpOptions): GridSealMcp {
  const {
    callTool: originalCallTool,
    chainId,
    storage,
    modelProvider = "mcp",
    sessionId = null,
    actorId = null,
  } = options;

  let chain: ChainState = createChain(chainId);

  const callTool = async (
    callOptions: InterceptCallOptions
  ): Promise<Result<CapturedToolCall, McpCaptureError>> => {
    const {
      name,
      arguments: toolArgs,
      decisionType = "tool_call",
      tags,
      annotation = null,
      parentEntryId = null,
    } = callOptions;

    const inputPayload: Record<string, unknown> = {
      name,
      arguments: toolArgs ?? {},
    };
    const inputHash = sha256(canonicalize(inputPayload));

    const callParams: McpToolCallParams = toolArgs !== undefined
      ? { name, arguments: toolArgs }
      : { name };

    let result: McpToolResult;
    try {
      result = await originalCallTool(callParams);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return err({ type: "MCP_CALL_ERROR", message });
    }

    const textContent = extractTextContent(result);
    const outputPayload: Record<string, unknown> = {
      content: textContent,
      isError: result.isError ?? false,
    };
    const outputHash = sha256(canonicalize(outputPayload));

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

    return ok({ result, entryId });
  };

  const getChain = (): ChainState => chain;

  return { callTool, getChain };
}
