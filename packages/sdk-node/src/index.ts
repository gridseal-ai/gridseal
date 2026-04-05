export type {
  CapturedCompletion,
  CaptureError,
  GridSealOpenAI,
  GridSealOpenAIOptions,
  CreateCompletionOptions,
} from "./adapters/openai.js";

export { wrapOpenAI } from "./adapters/openai.js";

export type {
  CapturedMessage,
  CaptureError as AnthropicCaptureError,
  GridSealAnthropic,
  GridSealAnthropicOptions,
  CreateMessageOptions,
} from "./adapters/anthropic.js";

export { wrapAnthropic } from "./adapters/anthropic.js";
