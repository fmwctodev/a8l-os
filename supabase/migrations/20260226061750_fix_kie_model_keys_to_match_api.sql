/*
  # Fix KIE Model Keys to Match Official API Documentation

  All model keys in the kie_models table were incorrect, causing "The model name
  you specified is not supported" errors from the KIE API. This migration updates
  every model_key to match the exact values required by https://docs.kie.ai/.

  1. Image Model Key Fixes
    - `flux/flux-2` -> `flux-2/pro-text-to-image`
    - `google/imagen-4` -> `google/imagen4`
    - `nano-banana/nano-banana-pro` -> `nano-banana-pro`
    - `seedream/seedream-4.5` -> `seedream/4.5-text-to-image`
    - `openai/4o-image` -> `openai/4o-image` (unchanged, uses dedicated endpoint)
    - `flux/flux-1-kontext` -> `flux-kontext-pro` (uses dedicated endpoint)
    - `ideogram/ideogram-v3` -> `ideogram/v3-text-to-image`
    - `ideogram/ideogram-character` -> `ideogram/v3-text-to-image` (merged)
    - `nano-banana/nano-banana-api` -> `google/nano-banana`
    - `seedream/seedream-api` -> `bytedance/seedream`
    - `qwen/qwen-image-edit` -> `qwen/image-edit`
    - `z-image/z-image` -> `z-image`

  2. Video Model Key Fixes
    - `openai/sora-2` -> `sora-2-text-to-video`
    - `seedance/seedance-1.5-pro` -> `bytedance/seedance-1.5-pro`
    - `openai/sora-2-pro` -> `sora-2-pro-text-to-video`
    - `openai/sora-2-pro-storyboard` -> `sora-2-pro-storyboard`
    - `kling/kling-2.6` -> `kling-2.6/text-to-video`
    - `kling/kling-2.1` -> `kling/v2-1-standard`
    - `kling/kling-2.5` -> `kling/v2-5-turbo-text-to-video-pro`
    - `wan/wan-2.5` -> `wan/2-6-text-to-video`
    - `wan/wan-2.2` -> `wan/2-6-text-to-video` (consolidated to latest)
    - `hailuo/hailuo-2.3` -> `hailuo/02-text-to-video-standard`
    - `xai/grok-imagine` -> `grok-imagine/text-to-video`
    - `openai/sora-watermark-remover` -> `sora-watermark-remover`

  3. Endpoint Override Additions
    - 4o Image API: set api_endpoint_override to dedicated 4o endpoint
    - Flux Kontext: set api_endpoint_override to dedicated kontext endpoint

  4. Consolidation
    - Removed duplicate Ideogram Character entry (merged into Ideogram V3)
    - Consolidated two Wan entries (2.2 and 2.5) since KIE only offers Wan 2.6 now
*/

-- Image models
UPDATE kie_models SET model_key = 'flux-2/pro-text-to-image'
  WHERE model_key = 'flux/flux-2';

UPDATE kie_models SET model_key = 'google/imagen4'
  WHERE model_key = 'google/imagen-4';

UPDATE kie_models SET model_key = 'nano-banana-pro'
  WHERE model_key = 'nano-banana/nano-banana-pro';

UPDATE kie_models SET model_key = 'seedream/4.5-text-to-image'
  WHERE model_key = 'seedream/seedream-4.5';

UPDATE kie_models SET api_endpoint_override = 'https://api.kie.ai/api/v1/gpt4o-image/generate'
  WHERE model_key = 'openai/4o-image';

UPDATE kie_models SET model_key = 'flux-kontext-pro',
  api_endpoint_override = 'https://api.kie.ai/api/v1/flux/kontext/generate'
  WHERE model_key = 'flux/flux-1-kontext';

UPDATE kie_models SET model_key = 'ideogram/v3-text-to-image'
  WHERE model_key = 'ideogram/ideogram-v3';

UPDATE kie_models SET model_key = 'google/nano-banana'
  WHERE model_key = 'nano-banana/nano-banana-api';

UPDATE kie_models SET model_key = 'bytedance/seedream'
  WHERE model_key = 'seedream/seedream-api';

UPDATE kie_models SET model_key = 'qwen/image-edit'
  WHERE model_key = 'qwen/qwen-image-edit';

UPDATE kie_models SET model_key = 'z-image'
  WHERE model_key = 'z-image/z-image';

-- Remove duplicate ideogram character (merged into v3)
DELETE FROM kie_models WHERE model_key = 'ideogram/ideogram-character';

-- Video models
UPDATE kie_models SET model_key = 'sora-2-text-to-video'
  WHERE model_key = 'openai/sora-2';

UPDATE kie_models SET model_key = 'bytedance/seedance-1.5-pro'
  WHERE model_key = 'seedance/seedance-1.5-pro';

UPDATE kie_models SET model_key = 'sora-2-pro-text-to-video'
  WHERE model_key = 'openai/sora-2-pro';

UPDATE kie_models SET model_key = 'sora-2-pro-storyboard'
  WHERE model_key = 'openai/sora-2-pro-storyboard';

UPDATE kie_models SET model_key = 'kling-2.6/text-to-video'
  WHERE model_key = 'kling/kling-2.6';

UPDATE kie_models SET model_key = 'kling/v2-1-standard'
  WHERE model_key = 'kling/kling-2.1';

UPDATE kie_models SET model_key = 'kling/v2-5-turbo-text-to-video-pro'
  WHERE model_key = 'kling/kling-2.5';

-- Consolidate wan/wan-2.2 into wan/wan-2.5 then update to correct key
DELETE FROM kie_models WHERE model_key = 'wan/wan-2.2';

UPDATE kie_models SET model_key = 'wan/2-6-text-to-video',
  display_name = 'Wan 2.6'
  WHERE model_key = 'wan/wan-2.5';

UPDATE kie_models SET model_key = 'hailuo/02-text-to-video-standard'
  WHERE model_key = 'hailuo/hailuo-2.3';

UPDATE kie_models SET model_key = 'grok-imagine/text-to-video'
  WHERE model_key = 'xai/grok-imagine';

UPDATE kie_models SET model_key = 'sora-watermark-remover'
  WHERE model_key = 'openai/sora-watermark-remover';
