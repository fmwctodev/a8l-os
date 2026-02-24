/*
  # Seed Kie.ai Model Registry

  Populates kie_models with all available models from Kie.ai platform.
  All models start disabled (enabled = false) since no API credentials exist yet.

  1. Video Models (14 models)
    - Sora 2, Sora 2 Pro, Sora 2 Pro Storyboard
    - Veo 3 API, Veo 3.1 API
    - Grok Imagine
    - Seedance API
    - Kling 2.1, Kling 2.5, Kling 2.6
    - Wan 2.2, Wan 2.5
    - Hailuo 2.3
    - Sora Watermark Remover (utility)

  2. Image Models (12 models)
    - Nano Banana Pro, Nano Banana API
    - Seedream 4.5, Seedream API
    - Flux.2, Flux.1 Kontext API
    - 4o Image API
    - Imagen 4
    - Ideogram V3, Ideogram Character
    - Qwen Image Edit
    - Z-Image

  All models seeded with known capabilities and recommended flags.
*/

-- VIDEO MODELS

INSERT INTO kie_models (provider, model_key, display_name, type, supports_aspect_ratios, supports_durations, supports_resolutions, supports_reference_images, supports_negative_prompt, default_params, enabled, is_recommended, display_priority, badge_label, short_description, api_endpoint_override)
VALUES
(
  'openai', 'openai/sora-2', 'Sora 2', 'video',
  '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
  '[5,10,15,20]'::jsonb,
  '["480p","720p","1080p"]'::jsonb,
  true, false,
  '{"aspect_ratio":"16:9","duration":10}'::jsonb,
  false, true, 10, 'POPULAR',
  'OpenAI flagship video model with excellent prompt adherence',
  NULL
),
(
  'openai', 'openai/sora-2-pro', 'Sora 2 Pro', 'video',
  '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
  '[5,10,15,20]'::jsonb,
  '["720p","1080p"]'::jsonb,
  true, false,
  '{"aspect_ratio":"16:9","duration":10}'::jsonb,
  false, false, 15, 'PRO',
  'Enhanced Sora with higher quality output and longer generations',
  NULL
),
(
  'openai', 'openai/sora-2-pro-storyboard', 'Sora 2 Pro Storyboard', 'video',
  '["16:9","9:16"]'::jsonb,
  '[10,15,20]'::jsonb,
  '["720p","1080p"]'::jsonb,
  true, false,
  '{"aspect_ratio":"16:9","duration":15}'::jsonb,
  false, false, 16, NULL,
  'Multi-scene storyboard-driven video generation',
  NULL
),
(
  'google', 'google/veo-3', 'Veo 3 API', 'video',
  '["1:1","16:9","9:16"]'::jsonb,
  '[5,8]'::jsonb,
  '["720p","1080p"]'::jsonb,
  false, false,
  '{"aspect_ratio":"16:9","duration":8}'::jsonb,
  false, true, 20, 'NEW',
  'Google DeepMind video model with audio generation support',
  'https://api.kie.ai/api/v1/veo/generate'
),
(
  'google', 'google/veo-3.1', 'Veo 3.1 API', 'video',
  '["1:1","16:9","9:16"]'::jsonb,
  '[5,8]'::jsonb,
  '["720p","1080p"]'::jsonb,
  false, false,
  '{"aspect_ratio":"16:9","duration":8}'::jsonb,
  false, true, 21, 'LATEST',
  'Latest Google video model with improved quality and coherence',
  'https://api.kie.ai/api/v1/veo/generate'
),
(
  'xai', 'xai/grok-imagine', 'Grok Imagine', 'video',
  '["1:1","16:9","9:16"]'::jsonb,
  '[5,10]'::jsonb,
  '["720p","1080p"]'::jsonb,
  true, false,
  '{"aspect_ratio":"16:9","duration":5}'::jsonb,
  false, false, 50, NULL,
  'xAI video generation model',
  NULL
),
(
  'seedance', 'seedance/seedance-1.5-pro', 'Seedance API', 'video',
  '["1:1","16:9","9:16","4:3","3:4","3:2","2:3"]'::jsonb,
  '[5,10]'::jsonb,
  '["720p","1080p"]'::jsonb,
  true, true,
  '{"aspect_ratio":"16:9","duration":5}'::jsonb,
  false, true, 12, 'FAST',
  'Fast video generation with strong motion quality and image-to-video',
  NULL
),
(
  'kling', 'kling/kling-2.1', 'Kling 2.1', 'video',
  '["1:1","16:9","9:16"]'::jsonb,
  '[5,10]'::jsonb,
  '["720p","1080p"]'::jsonb,
  true, false,
  '{"aspect_ratio":"16:9","duration":5}'::jsonb,
  false, false, 30, NULL,
  'Kling AI video generation with good motion control',
  NULL
),
(
  'kling', 'kling/kling-2.5', 'Kling 2.5', 'video',
  '["1:1","16:9","9:16"]'::jsonb,
  '[5,10]'::jsonb,
  '["720p","1080p"]'::jsonb,
  true, false,
  '{"aspect_ratio":"16:9","duration":5}'::jsonb,
  false, false, 31, NULL,
  'Improved Kling with better visual quality',
  NULL
),
(
  'kling', 'kling/kling-2.6', 'Kling 2.6', 'video',
  '["1:1","16:9","9:16"]'::jsonb,
  '[5,10]'::jsonb,
  '["720p","1080p"]'::jsonb,
  true, false,
  '{"aspect_ratio":"16:9","duration":5}'::jsonb,
  false, true, 25, 'NEW',
  'Latest Kling model with state-of-the-art motion quality',
  NULL
),
(
  'wan', 'wan/wan-2.2', 'Wan 2.2', 'video',
  '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
  '[5,10]'::jsonb,
  '["480p","720p"]'::jsonb,
  true, false,
  '{"aspect_ratio":"16:9","duration":5}'::jsonb,
  false, false, 40, NULL,
  'Open-source video generation model',
  NULL
),
(
  'wan', 'wan/wan-2.5', 'Wan 2.5', 'video',
  '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
  '[5,10]'::jsonb,
  '["480p","720p","1080p"]'::jsonb,
  true, false,
  '{"aspect_ratio":"16:9","duration":5}'::jsonb,
  false, false, 35, NULL,
  'Improved Wan model with higher resolution support',
  NULL
),
(
  'hailuo', 'hailuo/hailuo-2.3', 'Hailuo 2.3', 'video',
  '["1:1","16:9","9:16"]'::jsonb,
  '[5,10]'::jsonb,
  '["720p","1080p"]'::jsonb,
  true, false,
  '{"aspect_ratio":"16:9","duration":5}'::jsonb,
  false, false, 45, NULL,
  'Hailuo AI video generation with cinematic quality',
  NULL
),
(
  'openai', 'openai/sora-watermark-remover', 'Sora Watermark Remover', 'video',
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  true, false,
  '{}'::jsonb,
  false, false, 99, 'UTILITY',
  'Removes watermarks from generated video content',
  NULL
)
ON CONFLICT (model_key) DO NOTHING;

-- IMAGE MODELS

INSERT INTO kie_models (provider, model_key, display_name, type, supports_aspect_ratios, supports_durations, supports_resolutions, supports_reference_images, supports_negative_prompt, default_params, enabled, is_recommended, display_priority, badge_label, short_description)
VALUES
(
  'nano-banana', 'nano-banana/nano-banana-pro', 'Nano Banana Pro', 'image',
  '["1:1","16:9","9:16","4:3","3:4","3:2","2:3"]'::jsonb,
  '[]'::jsonb,
  '["1024x1024","1536x1024","1024x1536"]'::jsonb,
  false, true,
  '{"aspect_ratio":"1:1","resolution":"1024x1024"}'::jsonb,
  false, true, 10, 'POPULAR',
  'High-quality image generation with fast output'
),
(
  'seedream', 'seedream/seedream-4.5', 'Seedream 4.5', 'image',
  '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
  '[]'::jsonb,
  '["1024x1024","1536x1024","1024x1536"]'::jsonb,
  false, true,
  '{"aspect_ratio":"1:1","resolution":"1024x1024"}'::jsonb,
  false, true, 12, 'HD',
  'Excellent photorealistic and artistic image generation'
),
(
  'flux', 'flux/flux-2', 'Flux.2', 'image',
  '["1:1","16:9","9:16","4:3","3:4","3:2","2:3"]'::jsonb,
  '[]'::jsonb,
  '["1024x1024","1536x1024","1024x1536","2048x2048"]'::jsonb,
  false, true,
  '{"aspect_ratio":"1:1","resolution":"1024x1024"}'::jsonb,
  false, true, 5, 'TOP PICK',
  'State-of-the-art text-to-image with exceptional quality'
),
(
  'nano-banana', 'nano-banana/nano-banana-api', 'Nano Banana API', 'image',
  '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
  '[]'::jsonb,
  '["1024x1024","1536x1024","1024x1536"]'::jsonb,
  false, true,
  '{"aspect_ratio":"1:1","resolution":"1024x1024"}'::jsonb,
  false, false, 55, NULL,
  'API version of Nano Banana image generator'
),
(
  'seedream', 'seedream/seedream-api', 'Seedream API', 'image',
  '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
  '[]'::jsonb,
  '["1024x1024","1536x1024","1024x1536"]'::jsonb,
  false, true,
  '{"aspect_ratio":"1:1","resolution":"1024x1024"}'::jsonb,
  false, false, 56, NULL,
  'API version of Seedream image generator'
),
(
  'openai', 'openai/4o-image', '4o Image API', 'image',
  '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
  '[]'::jsonb,
  '["1024x1024","1536x1024","1024x1536"]'::jsonb,
  true, false,
  '{"aspect_ratio":"1:1","resolution":"1024x1024"}'::jsonb,
  false, true, 15, 'NEW',
  'OpenAI GPT-4o native image generation'
),
(
  'flux', 'flux/flux-1-kontext', 'Flux.1 Kontext API', 'image',
  '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
  '[]'::jsonb,
  '["1024x1024","1536x1024","1024x1536"]'::jsonb,
  true, false,
  '{"aspect_ratio":"1:1","resolution":"1024x1024"}'::jsonb,
  false, false, 20, NULL,
  'Context-aware image editing and generation'
),
(
  'google', 'google/imagen-4', 'Imagen 4', 'image',
  '["1:1","16:9","9:16","4:3","3:4","3:2","2:3"]'::jsonb,
  '[]'::jsonb,
  '["1024x1024","1536x1024","1024x1536"]'::jsonb,
  false, false,
  '{"aspect_ratio":"1:1","resolution":"1024x1024"}'::jsonb,
  false, true, 8, 'LATEST',
  'Google latest image model with photorealistic output'
),
(
  'ideogram', 'ideogram/ideogram-v3', 'Ideogram V3', 'image',
  '["1:1","16:9","9:16","4:3","3:4","3:2","2:3","10:16","16:10"]'::jsonb,
  '[]'::jsonb,
  '["1024x1024","1536x1024","1024x1536"]'::jsonb,
  false, true,
  '{"aspect_ratio":"1:1","resolution":"1024x1024"}'::jsonb,
  false, false, 25, NULL,
  'Excellent typography and design-focused image generation'
),
(
  'ideogram', 'ideogram/ideogram-character', 'Ideogram Character', 'image',
  '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
  '[]'::jsonb,
  '["1024x1024","1536x1024","1024x1536"]'::jsonb,
  true, false,
  '{"aspect_ratio":"1:1","resolution":"1024x1024"}'::jsonb,
  false, false, 26, NULL,
  'Character-consistent image generation with reference support'
),
(
  'qwen', 'qwen/qwen-image-edit', 'Qwen Image Edit', 'image',
  '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
  '[]'::jsonb,
  '["1024x1024","1536x1024","1024x1536"]'::jsonb,
  true, false,
  '{"aspect_ratio":"1:1","resolution":"1024x1024"}'::jsonb,
  false, false, 60, 'EDIT',
  'AI-powered image editing and inpainting'
),
(
  'z-image', 'z-image/z-image', 'Z-Image', 'image',
  '["1:1","16:9","9:16","4:3","3:4"]'::jsonb,
  '[]'::jsonb,
  '["1024x1024","1536x1024","1024x1536"]'::jsonb,
  false, true,
  '{"aspect_ratio":"1:1","resolution":"1024x1024"}'::jsonb,
  false, false, 65, NULL,
  'Fast and versatile image generation model'
)
ON CONFLICT (model_key) DO NOTHING;
