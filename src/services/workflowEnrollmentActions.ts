import { supabase } from '../lib/supabase';
import { enrollContact } from './workflows';
import type { Workflow, WorkflowEnrollment } from '../types';

export interface BulkEnrollResult {
  enrolled: number;
  alreadyEnrolled: number;
  errors: Array<{ contactId: string; error: string }>;
  enrollmentIds: string[];
}

/**
 * Manually enroll a single contact into a published workflow.
 * Wraps services/workflows.enrollContact, but with consistent error
 * surfacing and a friendly default error message for already-enrolled.
 */
export async function manualEnroll(
  orgId: string,
  workflowId: string,
  contactId: string
): Promise<{ enrollment: WorkflowEnrollment | null; alreadyEnrolled: boolean; error?: string }> {
  try {
    const enrollment = await enrollContact(orgId, workflowId, contactId);
    return { enrollment, alreadyEnrolled: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to enroll contact';
    if (msg.toLowerCase().includes('already enrolled')) {
      return { enrollment: null, alreadyEnrolled: true };
    }
    return { enrollment: null, alreadyEnrolled: false, error: msg };
  }
}

/**
 * Bulk-enroll a list of contacts into a single published workflow.
 * Each contact is enrolled independently — failures and already-enrolled
 * cases are reported per contact rather than aborting the batch.
 *
 * Use for:
 *   - Selection-driven bulk enrollment from the contacts list
 *   - Re-enrolling a saved segment after a workflow change
 */
export async function bulkEnrollContacts(
  orgId: string,
  workflowId: string,
  contactIds: string[]
): Promise<BulkEnrollResult> {
  const result: BulkEnrollResult = {
    enrolled: 0,
    alreadyEnrolled: 0,
    errors: [],
    enrollmentIds: [],
  };

  // Process in series — small batches so we don't hammer Supabase
  for (const contactId of contactIds) {
    const r = await manualEnroll(orgId, workflowId, contactId);
    if (r.enrollment) {
      result.enrolled++;
      result.enrollmentIds.push(r.enrollment.id);
    } else if (r.alreadyEnrolled) {
      result.alreadyEnrolled++;
    } else if (r.error) {
      result.errors.push({ contactId, error: r.error });
    }
  }

  return result;
}

/**
 * Returns the published workflows in this org that a contact can be
 * manually enrolled into. Filters out workflows that don't allow manual
 * enrollment (this is hinted via the trigger node — workflows whose
 * trigger is webhook/scheduled-only might not be appropriate for manual
 * enrollment, but we don't currently have a hard signal for that, so we
 * return all published workflows and let the caller decide).
 */
export async function getEnrollableWorkflows(orgId: string): Promise<Workflow[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select('id, name, status, description, published_at, published_definition')
    .eq('org_id', orgId)
    .eq('status', 'published')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Workflow[];
}
