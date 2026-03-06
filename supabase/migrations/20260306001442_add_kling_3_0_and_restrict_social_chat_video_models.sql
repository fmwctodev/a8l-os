/*
  # Add Kling 3.0 and restrict AI Social Manager video models

  1. New Models
    - `Kling 3.0` (model_key: kling-3.0/video) - Top-priority default video model
      with multi-shot storytelling, native audio, and std/pro mode support

  2. Model Priority Changes
    - Kling 3.0: display_priority 1 (TOP PICK, default)
    - Veo 3.1: display_priority 2 (NEW)
    - Sora 2 Pro Storyboard: display_priority 3 (CINEMATIC)

  3. Disabled Models
    - All other video models disabled for AI Social Manager chat
    - Sora 2, Sora 2 Pro, Seedance, Veo 3, Kling 2.6, Kling 2.5, Kling 2.1,
      Wan 2.5/2.6/2.2, Hailuo, Grok Imagine, Sora Watermark Remover

  4. Sora 2 Pro Storyboard Updates
    - Updated supports_durations to [10, 15, 25] per API spec
    - Updated supports_aspect_ratios to ['16:9', '9:16'] per API spec

  5. Important Notes
    - Only Kling 3.0, Veo 3.1, and Sora 2 Pro Storyboard are available in the
      AI Social Manager chat video model selector
    - Image model (Nano Banana 2) remains unchanged and locked
    - Disabled models are NOT deleted, only hidden from selection
*/

INSERT INTO kie_models (
  model_key,
  display_name,
  type,
  provider,
  enabled,
  is_recommended,
  display_priority,
  badge_label,
  short_description,
  supports_aspect_ratios,
  supports_durations,
  supports_resolutions,
  supports_reference_images,
  supports_negative_prompt,
  default_params,
  min_credits,
  api_endpoint_override
)
SELECT
  'kling-3.0/video',
  'Kling 3.0',
  'video',
  'kling',
  true,
  true,
  1,
  'TOP PICK',
  'Multi-shot storytelling with native audio and flexible duration up to 15s',
  '["1:1", "16:9", "9:16"]'::jsonb,
  '[5, 10, 15]'::jsonb,
  '["1K", "2K"]'::jsonb,
  true,
  false,
  '{"duration": 10, "aspect_ratio": "16:9", "mode": "std"}'::jsonb,
  20,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM kie_models WHERE model_key = 'kling-3.0/video'
);

UPDATE kie_models
SET display_priority = 2,
    badge_label = 'NEW',
    is_recommended = true,
    enabled = true,
    short_description = 'Google Veo 3.1 with native audio, start/end frame control, and extend support'
WHERE model_key = 'google/veo-3.1';

UPDATE kie_models
SET display_priority = 3,
    badge_label = 'CINEMATIC',
    is_recommended = true,
    enabled = true,
    short_description = 'Multi-scene cinematic sequences up to 25s with visual consistency',
    supports_durations = '[10, 15, 25]'::jsonb,
    supports_aspect_ratios = '["16:9", "9:16"]'::jsonb
WHERE model_key = 'sora-2-pro-storyboard';

UPDATE kie_models
SET enabled = false
WHERE type = 'video'
  AND model_key NOT IN ('kling-3.0/video', 'google/veo-3.1', 'sora-2-pro-storyboard');
