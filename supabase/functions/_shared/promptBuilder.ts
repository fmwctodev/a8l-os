export interface StylePreset {
  id: string;
  name: string;
  display_name: string;
  description: string;
  camera_style: string;
  lighting: string;
  pacing: string;
  hook_required: boolean;
  subtitle_style: string;
  recommended_duration_min: number;
  recommended_duration_max: number;
  recommended_aspect_ratio: string | null;
  prompt_template: string;
  llm_context_snippet: string;
  enabled: boolean;
  display_priority: number;
}

export function buildStructuredPrompt(
  userPrompt: string,
  preset?: StylePreset | null
): string {
  if (!preset || !preset.prompt_template) {
    return userPrompt;
  }

  const filled = preset.prompt_template.replace("{prompt}", userPrompt);
  return filled;
}

export function buildLLMStyleContext(presets: StylePreset[]): string {
  if (!presets.length) return "";

  const lines: string[] = [
    "\nAvailable Media Styles (use these when suggesting visual_style_suggestion):",
  ];

  for (const p of presets) {
    if (!p.llm_context_snippet) continue;
    lines.push(`- ${p.display_name}: ${p.llm_context_snippet}`);
  }

  lines.push("");
  lines.push(
    'When the user requests a specific style or when a style matches the content type, incorporate the style\'s camera, lighting, and pacing attributes into your visual_style_suggestion. Also include a "style_preset" field in the draft JSON set to the style name (e.g., "ugc", "cinematic").'
  );

  return lines.join("\n");
}
