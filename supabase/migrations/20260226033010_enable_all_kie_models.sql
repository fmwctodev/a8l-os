/*
  # Enable All Kie.ai Models

  1. Changes
    - Enables all 26 models in `kie_models` table by setting `enabled = true`
    - Models include image generators (Flux.2, Imagen 4, Nano Banana Pro, etc.)
    - Models include video generators (Sora 2, Veo 3, Kling 2.6, Seedance, etc.)

  2. Reason
    - All models were seeded with `enabled = false` as a safety default
    - Now that the KIE_API_KEY is configured, models can be activated
*/

UPDATE kie_models SET enabled = true WHERE enabled = false;
