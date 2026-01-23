/*
  # Enable Media Feature Flag

  This migration enables the media feature flag to allow access to the 
  File Manager / Media Storage module with Google Drive integration.
*/

UPDATE feature_flags SET enabled = true WHERE key = 'media';
