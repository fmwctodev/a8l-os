export const CLARA_MODEL = "gpt-5.1";
export const CLARA_TEMPERATURE = 0.2;
export const CLARA_MAX_TOKENS = 4096;

if (CLARA_MODEL !== "gpt-5.1") {
  throw new Error("Clara model mismatch. Must use gpt-5.1.");
}

export function getResponsesApiUrl(baseUrl?: string): string {
  return baseUrl
    ? `${baseUrl}/v1/responses`
    : "https://api.openai.com/v1/responses";
}

export interface ResponsesApiInput {
  role: "system" | "user" | "assistant" | "developer";
  content: string;
}

export interface ResponsesApiRequest {
  model: string;
  input: ResponsesApiInput[];
  temperature: number;
  max_output_tokens: number;
  text?: { format?: { type: string } };
  tools?: unknown[];
  tool_choice?: string;
}

export interface ResponsesApiOutput {
  type: string;
  content?: Array<{ type: string; text?: string }>;
  name?: string;
  arguments?: string;
  call_id?: string;
  id?: string;
}

export interface ResponsesApiResponse {
  id: string;
  output: ResponsesApiOutput[];
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export function extractTextFromResponse(response: ResponsesApiResponse): string {
  for (const item of response.output) {
    if (item.type === "message" && item.content) {
      for (const block of item.content) {
        if (block.type === "output_text" && block.text) {
          return block.text;
        }
      }
    }
  }
  return "";
}

export function extractToolCallsFromResponse(
  response: ResponsesApiResponse
): Array<{ id: string; name: string; arguments: string; call_id: string }> {
  const calls: Array<{ id: string; name: string; arguments: string; call_id: string }> = [];
  for (const item of response.output) {
    if (item.type === "function_call" && item.name && item.arguments) {
      calls.push({
        id: item.id || crypto.randomUUID(),
        name: item.name,
        arguments: item.arguments,
        call_id: item.call_id || item.id || crypto.randomUUID(),
      });
    }
  }
  return calls;
}
