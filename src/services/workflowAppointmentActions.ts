import { supabase } from '../lib/supabase';
import type {
  CreateAppointmentConfig,
  CancelAppointmentConfig,
  RescheduleAppointmentConfig,
  ConfirmAppointmentConfig,
  SendReminderConfig,
  MarkNoShowConfig,
  AppointmentSource,
} from '../types/workflowActions';

export interface AppointmentActionContext {
  orgId: string;
  contactId: string;
  enrollmentId: string;
  actorUserId?: string;
  contextData?: Record<string, unknown>;
}

export interface AppointmentActionResult {
  success: boolean;
  appointmentId?: string;
  error?: string;
  data?: Record<string, unknown>;
}

async function resolveAppointmentId(
  source: AppointmentSource,
  context: AppointmentActionContext,
  specificId?: string
): Promise<string | null> {
  if (source === 'specific_id' && specificId) {
    return specificId;
  }

  if (source === 'context' && context.contextData?.appointmentId) {
    return context.contextData.appointmentId as string;
  }

  if (source === 'most_recent') {
    const { data } = await supabase
      .from('appointments')
      .select('id')
      .eq('org_id', context.orgId)
      .eq('contact_id', context.contactId)
      .eq('status', 'scheduled')
      .order('start_at_utc', { ascending: true })
      .limit(1)
      .maybeSingle();

    return data?.id || null;
  }

  return null;
}

async function resolveAssignee(
  orgId: string,
  calendarId: string,
  config: { assigneeType: string; assigneeId?: string },
  contactId: string
): Promise<string | null> {
  if (config.assigneeType === 'specific_user' && config.assigneeId) {
    return config.assigneeId;
  }

  if (config.assigneeType === 'contact_owner') {
    const { data: contact } = await supabase
      .from('contacts')
      .select('assigned_user_id')
      .eq('id', contactId)
      .maybeSingle();

    return contact?.assigned_user_id || null;
  }

  if (config.assigneeType === 'round_robin') {
    const { data: calendar } = await supabase
      .from('calendars')
      .select('type, owner_user_id, settings')
      .eq('id', calendarId)
      .single();

    if (!calendar) return null;

    if (calendar.type === 'user') {
      return calendar.owner_user_id;
    }

    const { data: members } = await supabase
      .from('calendar_members')
      .select('user_id, weight')
      .eq('calendar_id', calendarId)
      .eq('active', true);

    if (!members || members.length === 0) return null;

    const settings = calendar.settings as { last_assigned_index?: number } | null;
    const lastIndex = settings?.last_assigned_index || 0;
    const nextIndex = (lastIndex + 1) % members.length;

    await supabase
      .from('calendars')
      .update({
        settings: { ...settings, last_assigned_index: nextIndex },
      })
      .eq('id', calendarId);

    return members[nextIndex].user_id;
  }

  return null;
}

async function findNextAvailableSlot(
  orgId: string,
  calendarId: string,
  appointmentTypeId: string,
  startFromDate?: Date
): Promise<{ startTime: Date; endTime: Date; assigneeId: string } | null> {
  const { data: appointmentType } = await supabase
    .from('appointment_types')
    .select('duration_minutes, min_notice_minutes, booking_window_days')
    .eq('id', appointmentTypeId)
    .single();

  if (!appointmentType) return null;

  const { data: availabilityRules } = await supabase
    .from('availability_rules')
    .select('rules, timezone')
    .eq('calendar_id', calendarId)
    .limit(1)
    .maybeSingle();

  if (!availabilityRules) return null;

  const now = startFromDate || new Date();
  const minNoticeTime = new Date(now.getTime() + appointmentType.min_notice_minutes * 60 * 1000);
  const maxDate = new Date(now.getTime() + appointmentType.booking_window_days * 24 * 60 * 60 * 1000);

  const rules = availabilityRules.rules as Record<string, Array<{ start: string; end: string }>>;
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  let checkDate = new Date(Math.max(now.getTime(), minNoticeTime.getTime()));
  checkDate.setMinutes(0, 0, 0);

  while (checkDate < maxDate) {
    const dayName = dayNames[checkDate.getDay()];
    const dayRules = rules[dayName] || [];

    for (const rule of dayRules) {
      const [startHour, startMin] = rule.start.split(':').map(Number);
      const [endHour, endMin] = rule.end.split(':').map(Number);

      const slotStart = new Date(checkDate);
      slotStart.setHours(startHour, startMin, 0, 0);

      const dayEnd = new Date(checkDate);
      dayEnd.setHours(endHour, endMin, 0, 0);

      if (slotStart < minNoticeTime) {
        slotStart.setTime(minNoticeTime.getTime());
        slotStart.setMinutes(Math.ceil(slotStart.getMinutes() / 15) * 15, 0, 0);
      }

      while (slotStart.getTime() + appointmentType.duration_minutes * 60 * 1000 <= dayEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + appointmentType.duration_minutes * 60 * 1000);

        const { data: conflicts } = await supabase
          .from('appointments')
          .select('id')
          .eq('calendar_id', calendarId)
          .eq('status', 'scheduled')
          .or(`and(start_at_utc.lt.${slotEnd.toISOString()},end_at_utc.gt.${slotStart.toISOString()})`)
          .limit(1);

        if (!conflicts || conflicts.length === 0) {
          const { data: calendar } = await supabase
            .from('calendars')
            .select('type, owner_user_id')
            .eq('id', calendarId)
            .single();

          let assigneeId = calendar?.owner_user_id;

          if (calendar?.type === 'team') {
            const { data: members } = await supabase
              .from('calendar_members')
              .select('user_id')
              .eq('calendar_id', calendarId)
              .eq('active', true)
              .limit(1);

            assigneeId = members?.[0]?.user_id || null;
          }

          if (assigneeId) {
            return { startTime: slotStart, endTime: slotEnd, assigneeId };
          }
        }

        slotStart.setMinutes(slotStart.getMinutes() + 15);
      }
    }

    checkDate.setDate(checkDate.getDate() + 1);
    checkDate.setHours(0, 0, 0, 0);
  }

  return null;
}

export async function createAppointment(
  config: CreateAppointmentConfig,
  context: AppointmentActionContext
): Promise<AppointmentActionResult> {
  try {
    let startTime: Date;
    let endTime: Date;
    let assigneeId: string | null;

    const { data: appointmentType } = await supabase
      .from('appointment_types')
      .select('duration_minutes, generate_google_meet')
      .eq('id', config.appointmentTypeId)
      .single();

    if (!appointmentType) {
      return { success: false, error: 'Appointment type not found' };
    }

    const duration = config.duration || appointmentType.duration_minutes;

    if (config.startTimeType === 'next_available') {
      const slot = await findNextAvailableSlot(
        context.orgId,
        config.calendarId,
        config.appointmentTypeId
      );

      if (!slot) {
        return { success: false, error: 'No available slots found' };
      }

      startTime = slot.startTime;
      endTime = slot.endTime;
      assigneeId = slot.assigneeId;
    } else if (config.startTimeType === 'relative' && config.startTimeDays !== undefined) {
      startTime = new Date();
      startTime.setDate(startTime.getDate() + config.startTimeDays);
      if (config.startTimeHour !== undefined) {
        startTime.setHours(config.startTimeHour, 0, 0, 0);
      }
      endTime = new Date(startTime.getTime() + duration * 60 * 1000);
      assigneeId = await resolveAssignee(
        context.orgId,
        config.calendarId,
        { assigneeType: config.assigneeType, assigneeId: config.assigneeId },
        context.contactId
      );
    } else if (config.startDate && config.startTime) {
      startTime = new Date(`${config.startDate}T${config.startTime}`);
      endTime = new Date(startTime.getTime() + duration * 60 * 1000);
      assigneeId = await resolveAssignee(
        context.orgId,
        config.calendarId,
        { assigneeType: config.assigneeType, assigneeId: config.assigneeId },
        context.contactId
      );
    } else {
      return { success: false, error: 'Invalid start time configuration' };
    }

    if (!assigneeId) {
      return { success: false, error: 'Could not resolve assignee' };
    }

    const shouldGenerateMeet = config.generateGoogleMeet ?? appointmentType.generate_google_meet;
    let googleMeetLink: string | null = null;

    if (shouldGenerateMeet) {
      googleMeetLink = `https://meet.google.com/${generateMeetCode()}`;
    }

    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        org_id: context.orgId,
        calendar_id: config.calendarId,
        appointment_type_id: config.appointmentTypeId,
        contact_id: context.contactId,
        assigned_user_id: assigneeId,
        status: 'scheduled',
        start_at_utc: startTime.toISOString(),
        end_at_utc: endTime.toISOString(),
        visitor_timezone: 'America/New_York',
        source: 'manual',
        google_meet_link: googleMeetLink,
        notes: config.notes,
        history: [{
          action: 'created',
          timestamp: new Date().toISOString(),
          by: 'workflow',
          enrollment_id: context.enrollmentId,
        }],
      })
      .select()
      .single();

    if (error) throw error;

    if (config.sendConfirmation) {
      await supabase.from('inbox_events').insert({
        org_id: context.orgId,
        user_id: assigneeId,
        event_type: 'appointment_created',
        title: 'New Appointment Scheduled',
        body: `An appointment has been scheduled for ${startTime.toLocaleString()}`,
        metadata: { appointment_id: appointment.id },
        read: false,
      });
    }

    return {
      success: true,
      appointmentId: appointment.id,
      data: { appointment },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create appointment',
    };
  }
}

export async function cancelAppointment(
  config: CancelAppointmentConfig,
  context: AppointmentActionContext
): Promise<AppointmentActionResult> {
  try {
    const appointmentId = await resolveAppointmentId(
      config.appointmentSource,
      context,
      config.appointmentId
    );

    if (!appointmentId) {
      return { success: false, error: 'Appointment not found' };
    }

    const { data: currentAppt } = await supabase
      .from('appointments')
      .select('history, assigned_user_id, contact_id')
      .eq('id', appointmentId)
      .single();

    if (!currentAppt) {
      return { success: false, error: 'Appointment not found' };
    }

    const history = (currentAppt.history as Array<Record<string, unknown>>) || [];
    history.push({
      action: 'cancelled',
      timestamp: new Date().toISOString(),
      by: 'workflow',
      enrollment_id: context.enrollmentId,
      reason: config.reason,
    });

    const { data: appointment, error } = await supabase
      .from('appointments')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        history,
      })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) throw error;

    if (config.notifyAssignee && currentAppt.assigned_user_id) {
      await supabase.from('inbox_events').insert({
        org_id: context.orgId,
        user_id: currentAppt.assigned_user_id,
        event_type: 'appointment_cancelled',
        title: 'Appointment Cancelled',
        body: config.reason || 'An appointment has been cancelled',
        metadata: { appointment_id: appointmentId },
        read: false,
      });
    }

    return {
      success: true,
      appointmentId,
      data: { appointment },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel appointment',
    };
  }
}

export async function rescheduleAppointment(
  config: RescheduleAppointmentConfig,
  context: AppointmentActionContext
): Promise<AppointmentActionResult> {
  try {
    const appointmentId = await resolveAppointmentId(
      config.appointmentSource,
      context,
      config.appointmentId
    );

    if (!appointmentId) {
      return { success: false, error: 'Appointment not found' };
    }

    const { data: currentAppt } = await supabase
      .from('appointments')
      .select('*, appointment_type:appointment_types(duration_minutes)')
      .eq('id', appointmentId)
      .single();

    if (!currentAppt) {
      return { success: false, error: 'Appointment not found' };
    }

    let newStartTime: Date;
    const duration = (currentAppt.appointment_type as { duration_minutes: number })?.duration_minutes || 30;

    if (config.newStartTimeType === 'next_available') {
      const slot = await findNextAvailableSlot(
        context.orgId,
        currentAppt.calendar_id,
        currentAppt.appointment_type_id
      );

      if (!slot) {
        return { success: false, error: 'No available slots found' };
      }

      newStartTime = slot.startTime;
    } else if (config.newStartTimeType === 'relative' && config.newStartTimeDays !== undefined) {
      newStartTime = new Date();
      newStartTime.setDate(newStartTime.getDate() + config.newStartTimeDays);
    } else if (config.newStartDate && config.newStartTime) {
      newStartTime = new Date(`${config.newStartDate}T${config.newStartTime}`);
    } else {
      return { success: false, error: 'Invalid new start time configuration' };
    }

    const newEndTime = new Date(newStartTime.getTime() + duration * 60 * 1000);

    const history = (currentAppt.history as Array<Record<string, unknown>>) || [];
    history.push({
      action: 'rescheduled',
      timestamp: new Date().toISOString(),
      by: 'workflow',
      enrollment_id: context.enrollmentId,
      reason: config.reason,
      from: currentAppt.start_at_utc,
      to: newStartTime.toISOString(),
    });

    const { data: appointment, error } = await supabase
      .from('appointments')
      .update({
        start_at_utc: newStartTime.toISOString(),
        end_at_utc: newEndTime.toISOString(),
        history,
      })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      appointmentId,
      data: { appointment, previousStart: currentAppt.start_at_utc },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reschedule appointment',
    };
  }
}

export async function confirmAppointment(
  config: ConfirmAppointmentConfig,
  context: AppointmentActionContext
): Promise<AppointmentActionResult> {
  try {
    const appointmentId = await resolveAppointmentId(
      config.appointmentSource,
      context,
      config.appointmentId
    );

    if (!appointmentId) {
      return { success: false, error: 'Appointment not found' };
    }

    const { data: appointment } = await supabase
      .from('appointments')
      .select('*, contact:contacts(email, phone, first_name)')
      .eq('id', appointmentId)
      .single();

    if (!appointment) {
      return { success: false, error: 'Appointment not found' };
    }

    const contact = appointment.contact as { email: string; phone: string; first_name: string } | null;

    if (config.confirmationChannel === 'email' || config.confirmationChannel === 'both') {
      if (contact?.email) {
        await supabase.from('messages').insert({
          org_id: context.orgId,
          conversation_id: null,
          contact_id: context.contactId,
          direction: 'outbound',
          channel: 'email',
          content: `Your appointment has been confirmed for ${new Date(appointment.start_at_utc).toLocaleString()}`,
          status: 'queued',
          metadata: {
            appointment_id: appointmentId,
            type: 'confirmation',
          },
        });
      }
    }

    if (config.confirmationChannel === 'sms' || config.confirmationChannel === 'both') {
      if (contact?.phone) {
        await supabase.from('messages').insert({
          org_id: context.orgId,
          conversation_id: null,
          contact_id: context.contactId,
          direction: 'outbound',
          channel: 'sms',
          content: `Your appointment is confirmed for ${new Date(appointment.start_at_utc).toLocaleString()}`,
          status: 'queued',
          metadata: {
            appointment_id: appointmentId,
            type: 'confirmation',
          },
        });
      }
    }

    return {
      success: true,
      appointmentId,
      data: { appointment },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm appointment',
    };
  }
}

export async function sendAppointmentReminder(
  config: SendReminderConfig,
  context: AppointmentActionContext
): Promise<AppointmentActionResult> {
  try {
    const appointmentId = await resolveAppointmentId(
      config.appointmentSource,
      context,
      config.appointmentId
    );

    if (!appointmentId) {
      return { success: false, error: 'Appointment not found' };
    }

    const { data: appointment } = await supabase
      .from('appointments')
      .select('*, contact:contacts(email, phone, first_name), appointment_type:appointment_types(name)')
      .eq('id', appointmentId)
      .single();

    if (!appointment) {
      return { success: false, error: 'Appointment not found' };
    }

    const contact = appointment.contact as { email: string; phone: string; first_name: string } | null;
    const appointmentType = appointment.appointment_type as { name: string } | null;

    const reminderMessage = config.customMessage ||
      `Reminder: You have a ${appointmentType?.name || 'appointment'} scheduled for ${new Date(appointment.start_at_utc).toLocaleString()}`;

    if (config.reminderType === 'email' || config.reminderType === 'both') {
      if (contact?.email) {
        await supabase.from('messages').insert({
          org_id: context.orgId,
          conversation_id: null,
          contact_id: context.contactId,
          direction: 'outbound',
          channel: 'email',
          content: reminderMessage,
          status: 'queued',
          metadata: {
            appointment_id: appointmentId,
            type: 'reminder',
          },
        });
      }
    }

    if (config.reminderType === 'sms' || config.reminderType === 'both') {
      if (contact?.phone) {
        await supabase.from('messages').insert({
          org_id: context.orgId,
          conversation_id: null,
          contact_id: context.contactId,
          direction: 'outbound',
          channel: 'sms',
          content: reminderMessage,
          status: 'queued',
          metadata: {
            appointment_id: appointmentId,
            type: 'reminder',
          },
        });
      }
    }

    return {
      success: true,
      appointmentId,
      data: { appointment, reminderSent: true },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send reminder',
    };
  }
}

export async function markAppointmentNoShow(
  config: MarkNoShowConfig,
  context: AppointmentActionContext
): Promise<AppointmentActionResult> {
  try {
    const appointmentId = await resolveAppointmentId(
      config.appointmentSource,
      context,
      config.appointmentId
    );

    if (!appointmentId) {
      return { success: false, error: 'Appointment not found' };
    }

    const { data: currentAppt } = await supabase
      .from('appointments')
      .select('history')
      .eq('id', appointmentId)
      .single();

    if (!currentAppt) {
      return { success: false, error: 'Appointment not found' };
    }

    const history = (currentAppt.history as Array<Record<string, unknown>>) || [];
    history.push({
      action: 'no_show',
      timestamp: new Date().toISOString(),
      by: 'workflow',
      enrollment_id: context.enrollmentId,
      reason: config.reason,
    });

    const { data: appointment, error } = await supabase
      .from('appointments')
      .update({
        status: 'no_show',
        history,
      })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) throw error;

    if (config.createFollowUpTask) {
      await supabase.from('contact_tasks').insert({
        org_id: context.orgId,
        contact_id: context.contactId,
        title: 'Follow up on no-show appointment',
        description: config.reason || 'Contact did not show up for scheduled appointment',
        status: 'pending',
        priority: 'high',
        due_date: new Date().toISOString(),
      });
    }

    return {
      success: true,
      appointmentId,
      data: { appointment },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark appointment as no-show',
    };
  }
}

function generateMeetCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const generateSegment = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

  return `${generateSegment(3)}-${generateSegment(4)}-${generateSegment(3)}`;
}
