/*
  # Remove Webchat, Slack, Zapier, and Twilio integrations

  1. Changes
    - Delete integration records for webchat, slack, zapier, and twilio
    - Delete associated module_integration_requirements referencing these keys
    - Twilio connection is now managed via Vapi dashboard
    - Webchat, Slack, and Zapier are no longer offered

  2. Affected Tables
    - `module_integration_requirements` (delete rows referencing these keys)
    - `integration_connections` (delete any connections for these integrations)
    - `integration_logs` (delete any logs for these integrations)
    - `integrations` (delete 4 rows)
*/

DELETE FROM module_integration_requirements
WHERE integration_key IN ('webchat', 'slack', 'zapier', 'twilio');

DELETE FROM integration_logs
WHERE integration_id IN (
  SELECT id FROM integrations WHERE key IN ('webchat', 'slack', 'zapier', 'twilio')
);

DELETE FROM integration_connections
WHERE integration_id IN (
  SELECT id FROM integrations WHERE key IN ('webchat', 'slack', 'zapier', 'twilio')
);

DELETE FROM integrations
WHERE key IN ('webchat', 'slack', 'zapier', 'twilio');
