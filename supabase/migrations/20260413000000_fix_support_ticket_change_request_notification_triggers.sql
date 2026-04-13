/*
  Fix column name mismatch in notification triggers.

  Both notify_on_new_support_ticket() and notify_on_new_change_request()
  referenced NEW.organization_id, but the project_support_tickets and
  project_change_requests tables use 'org_id'. This caused every insert
  from both the CRM and the client portal to fail with:
    "record "new" has no field "organization_id"

  Fix: replace NEW.organization_id with NEW.org_id in both triggers.
  Also adds EXCEPTION handlers so notification failures never block
  the ticket/request creation itself.
*/

CREATE OR REPLACE FUNCTION notify_on_new_support_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_name text;
  v_target_users uuid[];
BEGIN
  SELECT p.name INTO v_project_name
  FROM projects p
  WHERE p.id = NEW.project_id;

  IF NEW.assigned_user_id IS NOT NULL THEN
    v_target_users := ARRAY[NEW.assigned_user_id];
  ELSE
    SELECT array_agg(u.id) INTO v_target_users
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.organization_id = NEW.org_id
      AND r.name IN ('SuperAdmin', 'Admin')
      AND u.status = 'active';
  END IF;

  IF v_target_users IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link, metadata)
    SELECT
      uid,
      'support_ticket',
      'New Support Ticket #' || NEW.ticket_number,
      COALESCE(NEW.subject, 'No subject') || ' from ' || COALESCE(NEW.client_name, 'Unknown client'),
      '/projects/' || NEW.project_id || '?tab=support',
      jsonb_build_object(
        'ticket_id', NEW.id,
        'project_id', NEW.project_id,
        'priority', NEW.priority,
        'source', NEW.source
      )
    FROM unnest(v_target_users) AS uid;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[notify_on_new_support_ticket] failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_on_new_change_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_name text;
  v_target_users uuid[];
BEGIN
  SELECT p.name INTO v_project_name
  FROM projects p
  WHERE p.id = NEW.project_id;

  IF NEW.reviewer_user_id IS NOT NULL THEN
    v_target_users := ARRAY[NEW.reviewer_user_id];
  ELSE
    SELECT array_agg(u.id) INTO v_target_users
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.organization_id = NEW.org_id
      AND r.name IN ('SuperAdmin', 'Admin')
      AND u.status = 'active';
  END IF;

  IF v_target_users IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link, metadata)
    SELECT
      uid,
      'change_request',
      'New Change Request',
      COALESCE(NEW.title, 'Untitled') || ' from ' || COALESCE(NEW.client_name, 'Unknown client'),
      '/projects/' || NEW.project_id || '?tab=changes',
      jsonb_build_object(
        'change_request_id', NEW.id,
        'project_id', NEW.project_id,
        'priority', NEW.priority,
        'request_type', NEW.request_type,
        'source', NEW.source
      )
    FROM unnest(v_target_users) AS uid;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[notify_on_new_change_request] failed: %', SQLERRM;
    RETURN NEW;
END;
$$;
