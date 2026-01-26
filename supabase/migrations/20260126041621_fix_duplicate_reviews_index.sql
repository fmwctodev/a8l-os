/*
  # Fix Duplicate Index on Reviews Table

  ## Overview
  The reviews table has duplicate indexes:
  - idx_reviews_is_spam
  - idx_reviews_spam
  
  Both index the same column(s), so we drop one to save storage and reduce
  index maintenance overhead.

  ## Change
  - Drop idx_reviews_spam (keeping idx_reviews_is_spam)
*/

DROP INDEX IF EXISTS idx_reviews_spam;
