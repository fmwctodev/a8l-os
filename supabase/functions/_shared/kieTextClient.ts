import { CLARA_MODEL, CLARA_TEMPERATURE } from "./claraConfig.ts";

const KIE_TEXT_BASE = "https://api.kie.ai/api/v1/chat/completions";
const MAX_OUTPUT_TOKENS = 4000;

export interface TextCompletionResult {
  content: string;
  model: string;
}

export async function generateTextViaKie(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  modelOverride?: string
): Promise<TextCompletionResult> {
  const model = modelOverride || `anthropic/${CLARA_MODEL}`;
  
  const response = await fetch(KIE_TEXT_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: messages.map(m => ({
        role: m.role === "system" ? "system" : m.role === "assistant" ? "assistant" : "user",
        content: m.content
      })),
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: CLARA_TEMPERATURE,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[kieTextClient] Kie.ai error:", response.status, errText);
    throw new Error(
      `AI generation failed via Kie.ai (Status ${response.status}): ${errText.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  
  return {
    content,
    model: data.model || model,
  };
}
