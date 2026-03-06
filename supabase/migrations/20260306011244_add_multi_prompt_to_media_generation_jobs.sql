/*
  # Add multi_prompt column to media_generation_jobs

  1. Modified Tables
    - `media_generation_jobs`
      - `multi_prompt` (jsonb, nullable) - Array of scene prompts for multi-shot video generation.
        Each entry has { prompt: string, duration: number }.

  2. Notes
    - This column stores the multi-shot prompt array separately from params for easier querying
    - Nullable because most jobs are single-shot and do not need this field
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_generation_jobs' AND column_name = 'multi_prompt'
  ) THEN
    ALTER TABLE media_generation_jobs ADD COLUMN multi_prompt jsonb DEFAULT NULL;
  END IF;
END $$;
