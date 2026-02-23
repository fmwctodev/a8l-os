/*
  # Fix assistant_messages message_type check constraint

  1. Problem
    - The check constraint on `assistant_messages.message_type` only allows:
      `text`, `tool_result`, `action_confirmation`, `draft_preview`, `meeting_summary`, `error`
    - The application code also uses: `execution_plan`, `execution_result`, `voice_transcript`
    - This causes 400 Bad Request errors when Clara tries to save messages

  2. Changes
    - Drop the existing `assistant_messages_message_type_check` constraint
    - Add an updated constraint that includes all message types used by the application

  3. Impact
    - Fixes Clara assistant chat failing with constraint violation errors
    - No data loss - only expanding the set of allowed values
*/

ALTER TABLE assistant_messages
  DROP CONSTRAINT IF EXISTS assistant_messages_message_type_check;

ALTER TABLE assistant_messages
  ADD CONSTRAINT assistant_messages_message_type_check
  CHECK (message_type = ANY (ARRAY[
    'text'::text,
    'tool_result'::text,
    'action_confirmation'::text,
    'draft_preview'::text,
    'meeting_summary'::text,
    'error'::text,
    'execution_plan'::text,
    'execution_result'::text,
    'voice_transcript'::text
  ]));
