/*
  # Fix KIE Image Model Resolution Values

  The KIE API expects resolution values like "1K" and "2K", not pixel
  dimensions like "1024x1024". All image generation jobs were failing with
  "resolution is not within the range of allowed options".

  1. Modified Tables
    - `kie_models` - Updated `supports_resolutions` for all image models
      - "1024x1024" -> "1K"
      - "1536x1024" -> "1K"
      - "1024x1536" -> "1K"
      - "2048x2048" -> "2K"

  2. Important Notes
    - Video models keep their existing resolution values (480p, 720p, 1080p)
    - The first array element is used as the default resolution
*/

UPDATE kie_models
SET supports_resolutions = '["1K", "2K"]'::jsonb
WHERE type = 'image'
  AND supports_resolutions @> '["2048x2048"]'::jsonb;

UPDATE kie_models
SET supports_resolutions = '["1K"]'::jsonb
WHERE type = 'image'
  AND NOT (supports_resolutions @> '["2048x2048"]'::jsonb)
  AND supports_resolutions @> '["1024x1024"]'::jsonb;
