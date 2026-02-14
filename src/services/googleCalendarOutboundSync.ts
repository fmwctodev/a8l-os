import { callEdgeFunction, parseEdgeFunctionError } from '../lib/edgeFunction';

async function callSyncApi(action: string, body: Record<string, unknown>) {
  const response = await callEdgeFunction('google-calendar-sync', { action, ...body });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(parseEdgeFunctionError(err, 'Sync failed'));
  }

  return response.json();
}

export async function syncAppointmentToGoogle(
  appointmentId: string,
  operation: 'create' | 'update' | 'reschedule' | 'delete' = 'create'
): Promise<{ synced: boolean; googleEventId?: string; meetLink?: string }> {
  try {
    const result = await callSyncApi('sync-appointment', { appointmentId, operation });
    const data = result.data || result;
    if (data.synced) {
      callSyncApi('sync-incremental', {}).catch(() => {});
    }
    return data;
  } catch (err) {
    console.error('Appointment sync failed:', err);
    return { synced: false };
  }
}

export async function syncBlockedSlotToGoogle(
  blockedSlotId: string,
  operation: 'create' | 'update' | 'delete' = 'create'
): Promise<{ synced: boolean; googleEventId?: string }> {
  try {
    const result = await callSyncApi('sync-blocked-slot', { blockedSlotId, operation });
    return result.data || result;
  } catch (err) {
    console.error('Blocked slot sync failed:', err);
    return { synced: false };
  }
}

export async function syncCalendarEventToGoogle(
  calendarEventId: string,
  operation: 'create' | 'update' | 'delete' = 'create',
  generateMeet = false
): Promise<{ synced: boolean; googleEventId?: string; meetLink?: string }> {
  try {
    const result = await callSyncApi('sync-calendar-event', { calendarEventId, operation, generateMeet });
    return result.data || result;
  } catch (err) {
    console.error('Calendar event sync failed:', err);
    return { synced: false };
  }
}

export async function syncTaskToGoogle(
  taskId: string,
  operation: 'create' | 'update' | 'delete' = 'create'
): Promise<{ synced: boolean; googleEventId?: string }> {
  try {
    const result = await callSyncApi('sync-task', { taskId, operation });
    return result.data || result;
  } catch (err) {
    console.error('Task sync failed:', err);
    return { synced: false };
  }
}
