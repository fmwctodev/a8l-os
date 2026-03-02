import {
  CLARA_MODEL,
  CLARA_TEMPERATURE,
  extractTextFromResponse,
  type ResponsesApiInput,
  type ResponsesApiResponse,
} from "./claraConfig.ts";

const MAX_OUTPUT_TOKENS = 2000;

export interface TextCompletionResult {
  content: string;
  model: string;
}

export async function generateText(
  apiUrl: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>
): Promise<TextCompletionResult> {
  const url = apiUrl.replace(/\/v1\/chat\/completions\/?$/, "/v1/responses");

  console.log("Clara using model:", CLARA_MODEL);

  const input: ResponsesApiInput[] = messages.map((m) => ({
    role: (m.role === "system" ? "developer" : m.role === "assistant" ? "assistant" : "user") as ResponsesApiInput["role"],
    content: m.content,
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CLARA_MODEL,
      input,
      temperature: CLARA_TEMPERATURE,
      max_output_tokens: MAX_OUTPUT_TOKENS,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[openaiTextClient] OpenAI error:", response.status, errText);
    throw new Error(
      `AI generation failed (OpenAI ${response.status}): ${errText.slice(0, 200)}`
    );
  }

  const data = await response.json() as ResponsesApiResponse;
  return {
    content: extractTextFromResponse(data),
    model: CLARA_MODEL,
  };
}
