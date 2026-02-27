/*
  # Seed Missing KIE Models

  1. New Models
    - `Ideogram Character` (image) - Character and portrait-focused image generation
    - `Wan 2.2` (video) - Standard Wan text-to-video model
    - `Wan 2.5` (video) - Improved Wan text-to-video model

  2. Notes
    - These models match the KIE API marketplace offerings
    - All models are enabled by default
    - Wan 2.6 already exists; adding 2.2 and 2.5 as separate entries
*/

INSERT INTO kie_models (
  provider, model_key, display_name, type,
  supports_aspect_ratios, supports_durations, supports_resolutions,
  supports_reference_images, supports_negative_prompt,
  default_params, enabled, is_recommended, display_priority,
  badge_label, short_description, api_endpoint_override, min_credits
)
VALUES
  (
    'ideogram',
    'ideogram/character-text-to-image',
    'Ideogram Character',
    'image',
    '["1:1","16:9","9:16","4:3","3:4","3:2","2:3"]'::jsonb,
    '[]'::jsonb,
    '["1024x1024","1536x1024","1024x1536"]'::jsonb,
    true,
    false,
    '{"resolution":"1024x1024","aspect_ratio":"1:1"}'::jsonb,
    true,
    false,
    26,
    NULL,
    'Character and portrait-focused image generation with consistent subjects',
    NULL,
    0
  ),
  (
    'wan',
    'wan/2-2-text-to-video',
    'Wan 2.2',
    'video',
    '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
    '[5,10]'::jsonb,
    '["480p","720p","1080p"]'::jsonb,
    true,
    false,
    '{"duration":5,"aspect_ratio":"16:9"}'::jsonb,
    true,
    false,
    36,
    NULL,
    'Standard Wan video generation with good quality output',
    NULL,
    0
  ),
  (
    'wan',
    'wan/2-5-text-to-video',
    'Wan 2.5',
    'video',
    '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
    '[5,10]'::jsonb,
    '["480p","720p","1080p"]'::jsonb,
    true,
    false,
    '{"duration":5,"aspect_ratio":"16:9"}'::jsonb,
    true,
    false,
    34,
    NULL,
    'Enhanced Wan model with improved visual quality and motion',
    NULL,
    0
  )
ON CONFLICT DO NOTHING;
