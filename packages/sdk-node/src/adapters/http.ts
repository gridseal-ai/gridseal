/**
 * Generic HTTP wrapper that auto-captures AI decisions into a GridSeal proof chain.
 *
 * Works with any HTTP-based AI API by accepting user-provided extractor functions
 * that know how to pull model info, token counts, and content from responses.
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

/** User-provided functions that extract audit-relevant data from an HTTP response. */
export type ResponseExtractors<TResponse> = {
  /** Extract the model identifier from the response. */
  readonly extractModelId: (response: TResponse) => string;
  /** Extract the text content from the response for output hashing. Returns null if no content. */
  readonly extractContent: (response: TResponse) => string | null;
  /** Extract input token count. Returns null if unavailable. */
  readonly extractInputTokens: (response: TResponse) => number | null;
  /** Extract output token count. Returns null if unavailable. */
  readonly extractOutputTokens: (response: TResponse) => number | null;
};

/** Function that performs the actual HTTP call. User provides this. */
export type HttpCallFn<TRequest, TResponse> = (
  request: TRequest
) => Promise<TResponse>;

/** Result of a wrapped HTTP call, containing both the response and the audit entry ID. */
export type CapturedHttpResponse<TResponse> = {
  readonly response: TResponse;
  readonly entryId: string;
};

/** Error from the capture/audit process (the HTTP call itself may have succeeded). */
export type HttpCaptureError = {
  readonly type: "HTTP_CALL_ERROR" | "CHAIN_APPEND_ERROR" | "STORAGE_ERROR";
  readonly message: string;
};

/** Options for creating a GridSealHttp wrapper. */
export type GridSealHttpOptions<TResponse> = {
  readonly modelProvider: string;
  readonly chainId: string;
  readonly storage: StorageAdapter;
  readonly extractors: ResponseExtractors<TResponse>;
  readonly sessionId?: string | null;
  readonly actorId?: string | null;
};

/** Options for a single HTTP call. */
export type HttpCallOptions<TRequest> = {
  readonly request: TRequest;
  readonly decisionType?: DecisionType | null;
  readonly tags?: Readonly<Record<string, string>>;
  readonly annotation?: string | null;
  readonly parentEntryId?: string | null;
};

/** Wraps an HTTP-based AI API to auto-capture calls into a proof chain. */
export type GridSealHttp<TRequest, TResponse> = {
  /** Make an HTTP call and auto-capture an audit entry. */
  readonly call: (
    callFn: HttpCallFn<TRequest, TResponse>,
    options: HttpCallOptions<TRequest>
  ) => Promise<Result<CapturedHttpResponse<TResponse>, HttpCaptureError>>;
  /** Access the current chain state. */
  readonly getChain: () => ChainState;
};

function generateEntryId(): string {
  return randomUUID();
}

/** Create a GridSealHttp wrapper for any HTTP-based AI API. */
export function wrapHttp<TRequest, TResponse>(
  options: GridSealHttpOptions<TResponse>
): GridSealHttp<TRequest, TResponse> {
  const {
    modelProvider,
    chainId,
    storage,
    extractors,
    sessionId = null,
    actorId = null,
  } = options;

  let chain: ChainState = createChain(chainId);

  const call = async (
    callFn: HttpCallFn<TRequest, TResponse>,
    callOptions: HttpCallOptions<TRequest>
  ): Promise<Result<CapturedHttpResponse<TResponse>, HttpCaptureError>> => {
    const {
      request,
      decisionType = "generation",
      tags,
      annotation = null,
      parentEntryId = null,
    } = callOptions;

    const inputHash = sha256(canonicalize(request));

    let response: TResponse;
    try {
      response = await callFn(request);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return err({ type: "HTTP_CALL_ERROR", message });
    }

    const content = extractors.extractContent(response);
    const outputHash = sha256(canonicalize(content));

    const entryId = generateEntryId();
    const timestamp = new Date().toISOString();

    const entryInput: AppendEntryInput = {
      entryId,
      timestamp,
      entryType: "ai_decision",
      parentEntryId,
      modelId: extractors.extractModelId(response),
      modelProvider,
      inputHash,
      outputHash,
      inputTokenCount: extractors.extractInputTokens(response),
      outputTokenCount: extractors.extractOutputTokens(response),
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

    return ok({ response, entryId });
  };

  const getChain = (): ChainState => chain;

  return { call, getChain };
}
