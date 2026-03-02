/*
  # Lock image generation to Nano Banana 2

  1. Changes
    - Disables ALL existing image models in `kie_models`
    - Inserts a new `nano-banana-2` image model as the sole enabled image model
      - `model_key`: nano-banana-2
      - `display_name`: Nano Banana 2
      - `type`: image
      - `provider`: nano-banana
      - `api_endpoint_override`: https://kie.ai/nano-banana-2
      - `is_recommended`: true
      - `badge_label`: TOP PICK
      - `display_priority`: 1 (always first)
    - Video models are NOT affected

  2. Rationale
    - Consolidates image generation to a single model for consistency and cost control
    - All image generation across Social Chat, Media Studio, and edge functions will use this model
*/

UPDATE kie_models
SET enabled = false
WHERE type = 'image';

INSERT INTO kie_models (
  model_key,
  display_name,
  provider,
  type,
  supports_aspect_ratios,
  supports_durations,
  supports_resolutions,
  supports_reference_images,
  supports_negative_prompt,
  default_params,
  enabled,
  is_recommended,
  display_priority,
  badge_label,
  short_description,
  api_endpoint_override,
  min_credits
) VALUES (
  'nano-banana-2',
  'Nano Banana 2',
  'nano-banana',
  'image',
  '["1:1","16:9","9:16","4:3","3:4","3:2","2:3"]'::jsonb,
  '[]'::jsonb,
  '["1K"]'::jsonb,
  false,
  true,
  '{"resolution": "1K", "aspect_ratio": "1:1"}'::jsonb,
  true,
  true,
  1,
  'TOP PICK',
  'Next-gen image generation with superior quality and detail',
  'https://kie.ai/nano-banana-2',
  0
)
ON CONFLICT (model_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  enabled = EXCLUDED.enabled,
  is_recommended = EXCLUDED.is_recommended,
  display_priority = EXCLUDED.display_priority,
  badge_label = EXCLUDED.badge_label,
  short_description = EXCLUDED.short_description,
  api_endpoint_override = EXCLUDED.api_endpoint_override;
