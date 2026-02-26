export interface StylePreset {
  id: string;
  name: string;
  display_name: string;
  prompt_template: string | null;
  llm_context_snippet: string | null;
  camera_style: string | null;
  lighting: string | null;
  pacing: string | null;
  recommended_aspect_ratio: string | null;
  recommended_duration_min: number | null;
  recommended_duration_max: number | null;
}

export function buildStructuredPrompt(
  rawPrompt: string,
  preset: StylePreset | null
): string {
  if (!preset?.prompt_template) return rawPrompt;

  const template = preset.prompt_template;
  if (template.includes("{prompt}")) {
    return template.replace("{prompt}", rawPrompt);
  }

  return `${template}\n\n${rawPrompt}`;
}

export function buildLLMStyleContext(presets: StylePreset[]): string {
  if (!presets.length) return "";

  const lines = presets
    .filter((p) => p.llm_context_snippet)
    .map((p) => `- ${p.display_name}: ${p.llm_context_snippet}`);

  if (!lines.length) return "";

  return `\nAvailable media style presets:\n${lines.join("\n")}`;
}
