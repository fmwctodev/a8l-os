/*
  # Add free-form guideline block fields to social_guidelines

  1. Modified Tables
    - `social_guidelines`
      - `content_themes` (jsonb, default []) - Ordered array of rich-text blocks defining content themes/topics the AI should focus on
      - `image_style` (jsonb, default []) - Ordered array of rich-text blocks defining image/visual style directives
      - `writing_style` (jsonb, default []) - Ordered array of rich-text blocks defining writing tone and style instructions

  2. Notes
    - Each block is stored as {"content": "<html>"} to support rich text
    - Existing structured columns (tone_preferences, words_to_avoid, etc.) are preserved for backward compatibility
    - These free-form blocks take priority in AI prompt building since they represent explicit user instructions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_guidelines' AND column_name = 'content_themes'
  ) THEN
    ALTER TABLE social_guidelines ADD COLUMN content_themes jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_guidelines' AND column_name = 'image_style'
  ) THEN
    ALTER TABLE social_guidelines ADD COLUMN image_style jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_guidelines' AND column_name = 'writing_style'
  ) THEN
    ALTER TABLE social_guidelines ADD COLUMN writing_style jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;
