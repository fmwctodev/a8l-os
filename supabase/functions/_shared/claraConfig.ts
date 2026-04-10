export const CLARA_MODEL = "claude-3-5-sonnet-20241022";
export const CLARA_MODEL_HEAVY = "claude-3-5-sonnet-20241022";
export const CLARA_TEMPERATURE = 0.2;
export const CLARA_MAX_TOKENS = 4096;
export const ANTHROPIC_API_VERSION = "2023-06-01";

export function getAnthropicMessagesUrl(): string {
  return "https://api.anthropic.com/v1/messages";
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  temperature?: number;
  system?: string;
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  tool_choice?: { type: string; name?: string };
  stream?: boolean;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicContentBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string | null;
  usage?: { input_tokens: number; output_tokens: number };
}

export function extractTextFromResponse(response: AnthropicResponse): string {
  for (const block of response.content) {
    if (block.type === "text" && block.text) {
      return block.text;
    }
  }
  return "";
}

export function extractToolCallsFromResponse(
  response: AnthropicResponse
): Array<{ id: string; name: string; arguments: string }> {
  const calls: Array<{ id: string; name: string; arguments: string }> = [];
  for (const block of response.content) {
    if (block.type === "tool_use" && block.name && block.id) {
      calls.push({
        id: block.id,
        name: block.name,
        arguments: JSON.stringify(block.input || {}),
      });
    }
  }
  return calls;
}

export function buildAnthropicHeaders(apiKey: string): Record<string, string> {
  if (!apiKey) {
    console.error("[AI] Attempting to build Anthropic headers with an empty API key");
  } else {
    console.log("[AI] Anthropic API key verified (length: " + apiKey.length + ")");
  }
  const trimmedKey = apiKey?.trim();
  return {
    "Content-Type": "application/json",
    "x-api-key": trimmedKey,
    "anthropic-version": ANTHROPIC_API_VERSION,
  };
}

export function convertToAnthropicMessages(
  messages: Array<{ role: string; content: string }>
): { system: string | undefined; messages: AnthropicMessage[] } {
  let system: string | undefined;
  const anthropicMessages: AnthropicMessage[] = [];

  for (const m of messages) {
    if (m.role === "system" || m.role === "developer") {
      system = system ? `${system}\n\n${m.content}` : m.content;
    } else {
      anthropicMessages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      });
    }
  }

  return { system, messages: anthropicMessages };
}
