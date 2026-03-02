const LOCKED_MODEL = "gpt-5.1";
const TEMPERATURE = 0.7;
const MAX_TOKENS = 2000;

export interface TextCompletionResult {
  content: string;
  model: string;
}

export async function generateText(
  apiUrl: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>
): Promise<TextCompletionResult> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: LOCKED_MODEL,
      messages,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[openaiTextClient] OpenAI error:", response.status, errText);
    throw new Error(
      `AI generation failed (OpenAI ${response.status}): ${errText.slice(0, 200)}`
    );
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    model: LOCKED_MODEL,
  };
}
