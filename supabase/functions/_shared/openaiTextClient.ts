import {
  CLARA_MODEL,
  CLARA_TEMPERATURE,
  extractTextFromResponse,
  getAnthropicMessagesUrl,
  buildAnthropicHeaders,
  convertToAnthropicMessages,
  type AnthropicResponse,
} from "./claraConfig.ts";

const MAX_OUTPUT_TOKENS = 2000;

export interface TextCompletionResult {
  content: string;
  model: string;
}

export async function generateText(
  _apiUrl: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>
): Promise<TextCompletionResult> {
  const url = getAnthropicMessagesUrl();
  const { system, messages: anthropicMessages } = convertToAnthropicMessages(messages);

  const response = await fetch(url, {
    method: "POST",
    headers: buildAnthropicHeaders(apiKey),
    body: JSON.stringify({
      model: CLARA_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: CLARA_TEMPERATURE,
      ...(system ? { system } : {}),
      messages: anthropicMessages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[anthropicTextClient] Anthropic error:", response.status, errText);
    throw new Error(
      `AI generation failed (Anthropic ${response.status}): ${errText.slice(0, 200)}`
    );
  }

  const data = await response.json() as AnthropicResponse;
  return {
    content: extractTextFromResponse(data),
    model: CLARA_MODEL,
  };
}
