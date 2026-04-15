-- Atomic contract signing RPC for public (anon) signing pages.
--
-- The public contract signing page runs as an anonymous user and cannot
-- UPDATE the contracts table under RLS (only authenticated org members can).
-- Previously, the frontend tried to update contracts directly, which silently
-- failed with zero rows affected — so the signature_status stayed 'viewed'
-- and the contract_signed_automation trigger never fired.
--
-- This RPC runs with SECURITY DEFINER so it bypasses RLS safely. It:
--   1. Verifies the signing token against contract_signature_requests
--   2. Inserts the contract_signatures record
--   3. Marks the signature request as 'signed'
--   4. Updates contracts.status + signature_status to 'signed'
--      (this fires handle_contract_signed -> opportunity to Closed Won +
--       auto-creates the Kickoff project)
--   5. Writes the 'signed' audit event
--
-- Security model: the function ONLY proceeds if the caller supplies a token
-- hash that matches the contract_signature_requests.access_token_hash row.
-- No unauthenticated user can update a contract they don't already have a
-- valid signing link for.

CREATE OR REPLACE FUNCTION public.public_finalize_contract_signature(
  p_request_id uuid,
  p_token_hash text,
  p_signer_name text,
  p_signer_email text,
  p_signature_type text,
  p_signature_text text,
  p_signature_image_url text,
  p_ip_address text,
  p_user_agent text,
  p_consent_text text,
  p_document_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_request record;
  v_contract_id uuid;
  v_signature_id uuid;
  v_now timestamptz := now();
BEGIN
  -- Verify the token + fetch request
  SELECT id, org_id, contract_id, status, expires_at
    INTO v_request
    FROM contract_signature_requests
    WHERE id = p_request_id
      AND access_token_hash = p_token_hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid signing token';
  END IF;

  IF v_request.status NOT IN ('pending', 'viewed', 'sent') THEN
    RAISE EXCEPTION 'Signature request is no longer valid (status: %)', v_request.status;
  END IF;

  IF v_request.expires_at IS NOT NULL AND v_request.expires_at < v_now THEN
    RAISE EXCEPTION 'Signature request has expired';
  END IF;

  v_contract_id := v_request.contract_id;

  -- 1. Insert the signature record
  INSERT INTO contract_signatures (
    org_id, contract_id, signature_request_id, signature_type,
    signature_text, signature_image_url, signer_name, signer_email,
    ip_address, user_agent, consent_text, document_hash
  ) VALUES (
    v_request.org_id, v_contract_id, p_request_id, p_signature_type,
    p_signature_text, p_signature_image_url, p_signer_name, p_signer_email,
    p_ip_address, p_user_agent, p_consent_text, p_document_hash
  ) RETURNING id INTO v_signature_id;

  -- 2. Update the signature request
  UPDATE contract_signature_requests
     SET status = 'signed', signed_at = v_now
   WHERE id = p_request_id;

  -- 3. Update the contract — this fires the contract_signed_automation trigger
  --    which runs handle_contract_signed() to advance the opportunity to
  --    Closed Won and create a Kickoff project.
  UPDATE contracts
     SET signature_status = 'signed',
         status = 'signed',
         signed_at = v_now,
         signer_name = p_signer_name,
         signer_email = p_signer_email,
         updated_at = v_now
   WHERE id = v_contract_id;

  -- 4. Insert the audit event
  INSERT INTO contract_audit_events (
    org_id, contract_id, event_type, actor_type, metadata
  ) VALUES (
    v_request.org_id, v_contract_id, 'signed', 'signer',
    jsonb_build_object(
      'request_id', p_request_id,
      'signature_id', v_signature_id,
      'signer_name', p_signer_name,
      'signer_email', p_signer_email,
      'ip_address', p_ip_address,
      'user_agent', p_user_agent,
      'document_hash', p_document_hash
    )
  );

  RETURN jsonb_build_object(
    'contract_id', v_contract_id,
    'signature_id', v_signature_id,
    'signed_at', v_now
  );
END;
$$;

-- Allow anon + authenticated to execute (the function itself verifies the token)
GRANT EXECUTE ON FUNCTION public.public_finalize_contract_signature(
  uuid, text, text, text, text, text, text, text, text, text, text
) TO anon, authenticated;

COMMENT ON FUNCTION public.public_finalize_contract_signature IS
'Atomically finalize a contract signature from the public signing page. Verifies the request token, inserts the signature, updates the request and contract (triggering handle_contract_signed for downstream automation), and records an audit event. Runs with SECURITY DEFINER to bypass RLS safely.';
