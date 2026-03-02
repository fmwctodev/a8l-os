/*
  # Remove Yelp Integration

  1. Changes
    - Remove 'yelp' from CHECK constraints on 4 tables:
      - `review_providers.provider`
      - `reviews.provider`
      - `review_requests.provider_preference`
      - `review_reply_queue.provider`
    - Drop `yelp_review_url` column from `reputation_settings`
    - Drop `yelp_business_id` column from `reputation_competitors`

  2. Rationale
    - Yelp integration is being removed from the application
    - No existing data uses the 'yelp' provider value (verified before migration)
    - Columns being dropped contain no data

  3. Safety
    - All CHECK constraints are recreated with the same name minus the 'yelp' value
    - Column drops are guarded with IF EXISTS checks
*/

-- 1. Update review_providers.provider CHECK constraint
ALTER TABLE review_providers DROP CONSTRAINT IF EXISTS review_providers_provider_check;
ALTER TABLE review_providers ADD CONSTRAINT review_providers_provider_check
  CHECK (provider = ANY (ARRAY['google'::text, 'facebook'::text, 'internal'::text]));

-- 2. Update reviews.provider CHECK constraint
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_provider_check;
ALTER TABLE reviews ADD CONSTRAINT reviews_provider_check
  CHECK (provider = ANY (ARRAY['google'::text, 'facebook'::text, 'internal'::text]));

-- 3. Update review_requests.provider_preference CHECK constraint
ALTER TABLE review_requests DROP CONSTRAINT IF EXISTS review_requests_provider_preference_check;
ALTER TABLE review_requests ADD CONSTRAINT review_requests_provider_preference_check
  CHECK (provider_preference = ANY (ARRAY['smart'::text, 'google'::text, 'facebook'::text, 'internal'::text]));

-- 4. Update review_reply_queue.provider CHECK constraint
ALTER TABLE review_reply_queue DROP CONSTRAINT IF EXISTS review_reply_queue_provider_check;
ALTER TABLE review_reply_queue ADD CONSTRAINT review_reply_queue_provider_check
  CHECK (provider = ANY (ARRAY['google'::text, 'facebook'::text]));

-- 5. Drop yelp_review_url column from reputation_settings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_settings' AND column_name = 'yelp_review_url'
  ) THEN
    ALTER TABLE reputation_settings DROP COLUMN yelp_review_url;
  END IF;
END $$;

-- 6. Drop yelp_business_id column from reputation_competitors
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reputation_competitors' AND column_name = 'yelp_business_id'
  ) THEN
    ALTER TABLE reputation_competitors DROP COLUMN yelp_business_id;
  END IF;
END $$;
