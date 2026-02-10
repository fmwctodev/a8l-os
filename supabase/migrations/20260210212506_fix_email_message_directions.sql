/*
  # Fix email message directions

  1. Changes
    - Updates 44 email messages that were incorrectly marked as 'outbound'
    - These messages were received FROM external senders but misclassified
      because the Gmail OAuth token email (autom8ionlab.com) differs from
      the email alias (sitehues.com) where mail was delivered
    - Sets direction to 'inbound' for any email message where from_email
      does not match any known Gmail OAuth token email in the system

  2. Important Notes
    - Only affects email channel messages with metadata containing from_email
    - Uses a safe subquery to identify the connected Gmail token emails
    - Does not affect SMS, webchat, or voice messages
*/

UPDATE messages
SET direction = 'inbound'
WHERE channel = 'email'
  AND direction = 'outbound'
  AND metadata::jsonb->>'from_email' IS NOT NULL
  AND LOWER(metadata::jsonb->>'from_email') NOT IN (
    SELECT LOWER(email) FROM gmail_oauth_tokens
  );
