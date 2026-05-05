/*
  # Workflow trigger event_outbox emitters — Phase 1

  The workflow_trigger_type enum defines events the workflow engine wants
  to dispatch on. Existing webhook triggers (trigger_webhook_*) write to
  webhook_deliveries for EXTERNAL webhook subscribers but do NOT write to
  event_outbox, which is what the workflow-processor polls.

  This migration adds parallel "emit_event_*" trigger functions that write
  to event_outbox so workflows with these trigger types can actually fire.

  Coverage:
    - contacts AFTER INSERT      → contact_created
    - contacts AFTER UPDATE      → contact_updated  (when meaningful columns change)
    - contact_tags AFTER INSERT  → contact_tag_added
    - contact_tags AFTER DELETE  → contact_tag_removed
    - opportunities AFTER INSERT → opportunity_created (skips web_form_* rows; form-submit Edge Function handles those)
    - opportunities AFTER UPDATE OF stage_id  → opportunity_stage_changed
    - opportunities AFTER UPDATE OF status    → opportunity_status_changed
    - appointments  AFTER UPDATE OF status    → appointment_canceled (when status → cancelled)
    - appointments  AFTER UPDATE OF start_at_utc → appointment_rescheduled

  All trigger functions use SECURITY DEFINER + explicit search_path, matching
  the existing webhook trigger pattern.

  Idempotent: drops + recreates each function/trigger.
*/

-- 1. contacts AFTER INSERT → contact_created
CREATE OR REPLACE FUNCTION emit_event_contact_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO event_outbox (org_id, event_type, contact_id, entity_type, entity_id, payload)
  VALUES (
    NEW.organization_id,
    'contact_created',
    NEW.id,
    'contact',
    NEW.id,
    jsonb_build_object(
      'contact_id', NEW.id,
      'first_name', NEW.first_name,
      'last_name',  NEW.last_name,
      'email',      NEW.email,
      'phone',      NEW.phone,
      'company',    NEW.company,
      'source',     NEW.source,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS emit_event_contact_created ON contacts;
CREATE TRIGGER emit_event_contact_created
  AFTER INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION emit_event_contact_created();

-- 2. contacts AFTER UPDATE → contact_updated  (only when meaningful columns change)
CREATE OR REPLACE FUNCTION emit_event_contact_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_changed_fields text[] := ARRAY[]::text[];
BEGIN
  IF NEW.first_name IS DISTINCT FROM OLD.first_name THEN v_changed_fields := array_append(v_changed_fields, 'first_name'); END IF;
  IF NEW.last_name  IS DISTINCT FROM OLD.last_name  THEN v_changed_fields := array_append(v_changed_fields, 'last_name');  END IF;
  IF NEW.email      IS DISTINCT FROM OLD.email      THEN v_changed_fields := array_append(v_changed_fields, 'email');      END IF;
  IF NEW.phone      IS DISTINCT FROM OLD.phone      THEN v_changed_fields := array_append(v_changed_fields, 'phone');      END IF;
  IF NEW.company    IS DISTINCT FROM OLD.company    THEN v_changed_fields := array_append(v_changed_fields, 'company');    END IF;
  IF NEW.job_title  IS DISTINCT FROM OLD.job_title  THEN v_changed_fields := array_append(v_changed_fields, 'job_title');  END IF;
  IF NEW.owner_id   IS DISTINCT FROM OLD.owner_id   THEN v_changed_fields := array_append(v_changed_fields, 'owner_id');   END IF;
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN v_changed_fields := array_append(v_changed_fields, 'department_id'); END IF;
  IF NEW.status     IS DISTINCT FROM OLD.status     THEN v_changed_fields := array_append(v_changed_fields, 'status');     END IF;

  -- Skip if nothing meaningful changed (only updated_at / system columns)
  IF array_length(v_changed_fields, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO event_outbox (org_id, event_type, contact_id, entity_type, entity_id, payload)
  VALUES (
    NEW.organization_id,
    'contact_updated',
    NEW.id,
    'contact',
    NEW.id,
    jsonb_build_object(
      'contact_id', NEW.id,
      'changed_fields', v_changed_fields,
      'old_values', jsonb_build_object(
        'first_name', OLD.first_name,
        'last_name',  OLD.last_name,
        'email',      OLD.email,
        'phone',      OLD.phone,
        'company',    OLD.company,
        'job_title',  OLD.job_title,
        'owner_id',   OLD.owner_id,
        'department_id', OLD.department_id,
        'status',     OLD.status
      ),
      'new_values', jsonb_build_object(
        'first_name', NEW.first_name,
        'last_name',  NEW.last_name,
        'email',      NEW.email,
        'phone',      NEW.phone,
        'company',    NEW.company,
        'job_title',  NEW.job_title,
        'owner_id',   NEW.owner_id,
        'department_id', NEW.department_id,
        'status',     NEW.status
      )
    )
  );

  -- Specialized event for owner-change
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    INSERT INTO event_outbox (org_id, event_type, contact_id, entity_type, entity_id, payload)
    VALUES (
      NEW.organization_id, 'contact_owner_changed', NEW.id, 'contact', NEW.id,
      jsonb_build_object('contact_id', NEW.id, 'old_owner_id', OLD.owner_id, 'new_owner_id', NEW.owner_id)
    );
  END IF;

  -- Specialized event for department-change
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    INSERT INTO event_outbox (org_id, event_type, contact_id, entity_type, entity_id, payload)
    VALUES (
      NEW.organization_id, 'contact_department_changed', NEW.id, 'contact', NEW.id,
      jsonb_build_object('contact_id', NEW.id, 'old_department_id', OLD.department_id, 'new_department_id', NEW.department_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS emit_event_contact_updated ON contacts;
CREATE TRIGGER emit_event_contact_updated
  AFTER UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION emit_event_contact_updated();

-- 3. contact_tags AFTER INSERT → contact_tag_added
CREATE OR REPLACE FUNCTION emit_event_contact_tag_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_tag_name text;
BEGIN
  SELECT organization_id INTO v_org_id FROM contacts WHERE id = NEW.contact_id;
  SELECT name INTO v_tag_name FROM tags WHERE id = NEW.tag_id;
  IF v_org_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO event_outbox (org_id, event_type, contact_id, entity_type, entity_id, payload)
  VALUES (
    v_org_id,
    'contact_tag_added',
    NEW.contact_id,
    'contact_tag',
    NEW.tag_id,
    jsonb_build_object(
      'contact_id', NEW.contact_id,
      'tag_id',     NEW.tag_id,
      'tag_name',   v_tag_name,
      'action',     'added'
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS emit_event_contact_tag_added ON contact_tags;
CREATE TRIGGER emit_event_contact_tag_added
  AFTER INSERT ON contact_tags
  FOR EACH ROW
  EXECUTE FUNCTION emit_event_contact_tag_added();

-- 4. contact_tags AFTER DELETE → contact_tag_removed
CREATE OR REPLACE FUNCTION emit_event_contact_tag_removed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_tag_name text;
BEGIN
  SELECT organization_id INTO v_org_id FROM contacts WHERE id = OLD.contact_id;
  SELECT name INTO v_tag_name FROM tags WHERE id = OLD.tag_id;
  IF v_org_id IS NULL THEN RETURN OLD; END IF;

  INSERT INTO event_outbox (org_id, event_type, contact_id, entity_type, entity_id, payload)
  VALUES (
    v_org_id,
    'contact_tag_removed',
    OLD.contact_id,
    'contact_tag',
    OLD.tag_id,
    jsonb_build_object(
      'contact_id', OLD.contact_id,
      'tag_id',     OLD.tag_id,
      'tag_name',   v_tag_name,
      'action',     'removed'
    )
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS emit_event_contact_tag_removed ON contact_tags;
CREATE TRIGGER emit_event_contact_tag_removed
  AFTER DELETE ON contact_tags
  FOR EACH ROW
  EXECUTE FUNCTION emit_event_contact_tag_removed();

-- 5. opportunities AFTER INSERT → opportunity_created
-- Skips rows whose source starts with 'web_form_' because form-submit Edge
-- Function emits opportunity_created itself with richer payload (form-aware
-- merge fields). UI-created and other opportunity inserts go through here.
CREATE OR REPLACE FUNCTION emit_event_opportunity_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.source IS NOT NULL AND NEW.source LIKE 'web_form_%' THEN
    RETURN NEW;
  END IF;

  INSERT INTO event_outbox (org_id, event_type, contact_id, entity_type, entity_id, payload)
  VALUES (
    NEW.org_id,
    'opportunity_created',
    NEW.contact_id,
    'opportunity',
    NEW.id,
    jsonb_build_object(
      'opportunity_id', NEW.id,
      'contact_id',     NEW.contact_id,
      'pipeline_id',    NEW.pipeline_id,
      'stage_id',       NEW.stage_id,
      'value_amount',   NEW.value_amount,
      'currency',       NEW.currency,
      'source',         NEW.source,
      'assigned_user_id', NEW.assigned_user_id,
      'created_by',     NEW.created_by,
      'created_at',     NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS emit_event_opportunity_created ON opportunities;
CREATE TRIGGER emit_event_opportunity_created
  AFTER INSERT ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION emit_event_opportunity_created();

-- 6. opportunities AFTER UPDATE OF stage_id → opportunity_stage_changed
CREATE OR REPLACE FUNCTION emit_event_opportunity_stage_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_old_stage_name text;
  v_new_stage_name text;
  v_pipeline_name  text;
BEGIN
  IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN RETURN NEW; END IF;
  SELECT name INTO v_old_stage_name FROM pipeline_stages WHERE id = OLD.stage_id;
  SELECT name INTO v_new_stage_name FROM pipeline_stages WHERE id = NEW.stage_id;
  SELECT name INTO v_pipeline_name  FROM pipelines       WHERE id = NEW.pipeline_id;

  INSERT INTO event_outbox (org_id, event_type, contact_id, entity_type, entity_id, payload)
  VALUES (
    NEW.org_id,
    'opportunity_stage_changed',
    NEW.contact_id,
    'opportunity',
    NEW.id,
    jsonb_build_object(
      'opportunity_id',     NEW.id,
      'contact_id',         NEW.contact_id,
      'pipeline_id',        NEW.pipeline_id,
      'pipeline_name',      v_pipeline_name,
      'old_stage_id',       OLD.stage_id,
      'old_stage_name',     v_old_stage_name,
      'new_stage_id',       NEW.stage_id,
      'new_stage_name',     v_new_stage_name,
      'stage_name',         v_new_stage_name,  -- alias for merge-field convenience: {{opportunity.stage_name}}
      'value_amount',       NEW.value_amount,
      'currency',           NEW.currency,
      'assigned_user_id',   NEW.assigned_user_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS emit_event_opportunity_stage_changed ON opportunities;
CREATE TRIGGER emit_event_opportunity_stage_changed
  AFTER UPDATE OF stage_id ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION emit_event_opportunity_stage_changed();

-- 7. opportunities AFTER UPDATE OF status → opportunity_status_changed (won/lost transitions)
CREATE OR REPLACE FUNCTION emit_event_opportunity_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  INSERT INTO event_outbox (org_id, event_type, contact_id, entity_type, entity_id, payload)
  VALUES (
    NEW.org_id,
    'opportunity_status_changed',
    NEW.contact_id,
    'opportunity',
    NEW.id,
    jsonb_build_object(
      'opportunity_id',     NEW.id,
      'contact_id',         NEW.contact_id,
      'old_status',         OLD.status,
      'new_status',         NEW.status,
      'status',             NEW.status,
      'value_amount',       NEW.value_amount,
      'currency',           NEW.currency,
      'lost_reason',        NEW.lost_reason,
      'closed_at',          NEW.closed_at,
      'assigned_user_id',   NEW.assigned_user_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS emit_event_opportunity_status_changed ON opportunities;
CREATE TRIGGER emit_event_opportunity_status_changed
  AFTER UPDATE OF status ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION emit_event_opportunity_status_changed();

-- 8. appointments AFTER UPDATE → appointment_canceled and appointment_rescheduled
CREATE OR REPLACE FUNCTION emit_event_appointment_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_event_type text;
  v_payload jsonb;
  v_visitor_tz text := COALESCE(NEW.visitor_timezone, 'America/New_York');
  v_start_at_minus_24h timestamptz;
  v_start_at_minus_1h  timestamptz;
BEGIN
  -- Canceled (status changed to canceled / cancelled)
  IF NEW.status IN ('canceled','cancelled') AND OLD.status NOT IN ('canceled','cancelled') THEN
    INSERT INTO event_outbox (org_id, event_type, contact_id, entity_type, entity_id, payload)
    VALUES (
      NEW.org_id,
      'appointment_canceled',
      NEW.contact_id,
      'appointment',
      NEW.id,
      jsonb_build_object(
        'appointment_id',   NEW.id,
        'contact_id',       NEW.contact_id,
        'calendar_id',      NEW.calendar_id,
        'start_at_utc',     NEW.start_at_utc,
        'canceled_at',      NEW.canceled_at,
        'visitor_timezone', v_visitor_tz
      )
    );
  END IF;

  -- Rescheduled (start_at_utc changed)
  IF NEW.start_at_utc IS DISTINCT FROM OLD.start_at_utc THEN
    v_start_at_minus_24h := NEW.start_at_utc - interval '24 hours';
    v_start_at_minus_1h  := NEW.start_at_utc - interval '1 hour';
    INSERT INTO event_outbox (org_id, event_type, contact_id, entity_type, entity_id, payload)
    VALUES (
      NEW.org_id,
      'appointment_rescheduled',
      NEW.contact_id,
      'appointment',
      NEW.id,
      jsonb_build_object(
        'appointment_id',       NEW.id,
        'contact_id',           NEW.contact_id,
        'calendar_id',          NEW.calendar_id,
        'old_start_at_utc',     OLD.start_at_utc,
        'old_end_at_utc',       OLD.end_at_utc,
        'start_at_utc',         NEW.start_at_utc,
        'end_at_utc',           NEW.end_at_utc,
        'visitor_timezone',     v_visitor_tz,
        'start_at_minus_24h',   v_start_at_minus_24h,
        'start_at_minus_1h',    v_start_at_minus_1h
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS emit_event_appointment_lifecycle ON appointments;
CREATE TRIGGER emit_event_appointment_lifecycle
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION emit_event_appointment_lifecycle();
