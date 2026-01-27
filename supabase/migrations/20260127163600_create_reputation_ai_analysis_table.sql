/*
  # Create Review AI Analysis Table

  1. New Tables
    - `review_ai_analysis`
      - Stores AI-generated analysis for each review
      - sentiment_score, themes, tags, summary
      - ai_provider used (openai/anthropic)

  2. Security
    - Enable RLS with appropriate policies
*/

-- Create review_ai_analysis table
CREATE TABLE IF NOT EXISTS review_ai_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  sentiment_score numeric(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  sentiment_label text CHECK (sentiment_label IN ('positive', 'neutral', 'negative')),
  themes text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  summary text,
  key_phrases text[] DEFAULT '{}',
  suggested_reply text,
  ai_provider text NOT NULL CHECK (ai_provider IN ('openai', 'anthropic')),
  model_used text,
  tokens_used integer,
  analyzed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(review_id)
);

CREATE INDEX IF NOT EXISTS idx_review_ai_analysis_org ON review_ai_analysis(organization_id);
CREATE INDEX IF NOT EXISTS idx_review_ai_analysis_review ON review_ai_analysis(review_id);
CREATE INDEX IF NOT EXISTS idx_review_ai_analysis_sentiment ON review_ai_analysis(sentiment_label);

ALTER TABLE review_ai_analysis ENABLE ROW LEVEL SECURITY;

-- Add foreign key from reviews to review_ai_analysis
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_ai_analysis_id_fkey'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_ai_analysis_id_fkey 
      FOREIGN KEY (ai_analysis_id) REFERENCES review_ai_analysis(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- RLS Policies for review_ai_analysis
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'review_ai_analysis' AND policyname = 'Users can view own org AI analysis'
  ) THEN
    CREATE POLICY "Users can view own org AI analysis"
      ON review_ai_analysis FOR SELECT
      TO authenticated
      USING (
        organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'review_ai_analysis' AND policyname = 'Service role can manage AI analysis'
  ) THEN
    CREATE POLICY "Service role can manage AI analysis"
      ON review_ai_analysis FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
