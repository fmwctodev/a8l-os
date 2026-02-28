/*
  # Fix kie_models default_params and supports metadata

  1. Changes
    - Update all image models: change `default_params.resolution` from `"1024x1024"` to `"1K"`
      (kie.ai API expects `"1K"`, `"2K"`, `"4K"` format, not pixel dimensions)
    - Update `seedream/4.5-text-to-image`: change `supports_resolutions` from `["1K"]` to `["2K", "4K"]`
      (Seedream 4.5 uses a `quality` parameter mapped from resolution: 2K = basic, 4K = high)

  2. Affected models (resolution fix)
    - bytedance/seedream
    - flux-2/pro-text-to-image
    - flux-kontext-pro
    - google/imagen4
    - google/nano-banana
    - ideogram/character-text-to-image
    - ideogram/v3-text-to-image
    - nano-banana-pro
    - openai/4o-image
    - qwen/image-edit
    - seedream/4.5-text-to-image
    - z-image

  3. Important notes
    - No destructive changes, only updating JSON metadata
    - The edge function kieAdapter.ts now normalizes resolution values,
      so even if old values slip through they will be handled correctly
*/

UPDATE kie_models
SET default_params = jsonb_set(default_params, '{resolution}', '"1K"')
WHERE type = 'image'
  AND default_params ? 'resolution'
  AND default_params->>'resolution' = '1024x1024';

UPDATE kie_models
SET supports_resolutions = '["2K", "4K"]'::jsonb
WHERE model_key = 'seedream/4.5-text-to-image';
