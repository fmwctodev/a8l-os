/*
  # Enable Automation Feature Flag

  Enables the automation/workflows module feature flag so users can access
  the workflow builder and automation features.

  This flag was already created in the initial seed migration, this just
  enables it.
*/

UPDATE feature_flags 
SET enabled = true, description = 'Automation/Workflows module for creating automated sequences'
WHERE key = 'automation';