/*
  # Extend proposal_activities activity_type check constraint for signatures

  1. Modified Tables
    - `proposal_activities`
      - Updated `activity_type` check constraint to include signature-related types:
        - `signature_sent` - when a signature request email is sent
        - `signature_viewed` - when a signer views the proposal
        - `signature_signed` - when a signer signs the proposal
        - `signature_declined` - when a signer declines to sign
        - `signature_expired` - when a signature request expires
        - `signature_voided` - when a signature request is voided

  2. Important Notes
    - This extends the existing constraint to support the proposal signature module
    - No data changes, only constraint modification
*/

ALTER TABLE proposal_activities
  DROP CONSTRAINT IF EXISTS proposal_activities_activity_type_check;

ALTER TABLE proposal_activities
  ADD CONSTRAINT proposal_activities_activity_type_check
  CHECK (activity_type = ANY (ARRAY[
    'created',
    'updated',
    'sent',
    'viewed',
    'commented',
    'status_changed',
    'ai_generated',
    'signature_sent',
    'signature_viewed',
    'signature_signed',
    'signature_declined',
    'signature_expired',
    'signature_voided'
  ]));
