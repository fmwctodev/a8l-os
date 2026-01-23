import { supabase } from '../lib/supabase';
import type { GoogleCalendarConnection } from '../types';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
}

export interface BusyPeriod {
  start: string;
  end: string;
}

export interface GoogleEventData {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: { email: string }[];
  conferenceData?: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: { type: string };
    };
  };
}

export function getGoogleOAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  return response.json();
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return response.json();
}

export async function getGoogleConnection(
  userId: string
): Promise<GoogleCalendarConnection | null> {
  const { data, error } = await supabase
    .from('google_calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveGoogleConnection(
  organizationId: string,
  userId: string,
  tokens: { access_token: string; refresh_token: string; expires_in: number },
  email: string
): Promise<GoogleCalendarConnection> {
  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { data, error } = await supabase
    .from('google_calendar_connections')
    .upsert({
      org_id: organizationId,
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: tokenExpiry,
      email,
      selected_calendar_ids: ['primary'],
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSelectedCalendars(
  connectionId: string,
  calendarIds: string[]
): Promise<void> {
  const { error } = await supabase
    .from('google_calendar_connections')
    .update({ selected_calendar_ids: calendarIds })
    .eq('id', connectionId);

  if (error) throw error;
}

export async function deleteGoogleConnection(userId: string): Promise<void> {
  const { error } = await supabase
    .from('google_calendar_connections')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}

export async function listUserCalendars(
  accessToken: string
): Promise<GoogleCalendarInfo[]> {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch calendars');
  }

  const data = await response.json();
  return (data.items || []).map((cal: Record<string, unknown>) => ({
    id: cal.id,
    summary: cal.summary,
    primary: cal.primary || false,
    accessRole: cal.accessRole,
  }));
}

export async function getBusyPeriods(
  accessToken: string,
  calendarIds: string[],
  timeMin: string,
  timeMax: string
): Promise<Map<string, BusyPeriod[]>> {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: calendarIds.map((id) => ({ id })),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch busy periods');
  }

  const data = await response.json();
  const result = new Map<string, BusyPeriod[]>();

  for (const [calId, calData] of Object.entries(data.calendars || {})) {
    const busyPeriods = ((calData as Record<string, unknown>).busy as BusyPeriod[]) || [];
    result.set(calId, busyPeriods);
  }

  return result;
}

export async function createGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventData: GoogleEventData,
  generateMeet: boolean = false
): Promise<{ eventId: string; meetLink?: string }> {
  const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);

  if (generateMeet) {
    url.searchParams.set('conferenceDataVersion', '1');
    eventData.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create event: ${error}`);
  }

  const data = await response.json();
  return {
    eventId: data.id,
    meetLink: data.conferenceData?.entryPoints?.find(
      (ep: { entryPointType: string }) => ep.entryPointType === 'video'
    )?.uri,
  };
}

export async function updateGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  updates: Partial<GoogleEventData>
): Promise<void> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update event: ${error}`);
  }
}

export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    throw new Error(`Failed to delete event: ${error}`);
  }
}

export async function syncAppointmentToGoogle(
  appointmentId: string,
  userId: string
): Promise<{ eventId: string; meetLink?: string } | null> {
  const connection = await getGoogleConnection(userId);
  if (!connection) return null;

  const { data: appointment } = await supabase
    .from('appointments')
    .select(`
      *,
      appointment_type:appointment_types(*),
      contact:contacts(first_name, last_name, email)
    `)
    .eq('id', appointmentId)
    .single();

  if (!appointment) return null;

  const appointmentType = appointment.appointment_type;
  const contact = appointment.contact;

  const eventData: GoogleEventData = {
    summary: `${appointmentType?.name || 'Appointment'} - ${contact?.first_name || 'Guest'} ${contact?.last_name || ''}`.trim(),
    description: `Booked via CRM`,
    start: {
      dateTime: appointment.start_at_utc,
      timeZone: 'UTC',
    },
    end: {
      dateTime: appointment.end_at_utc,
      timeZone: 'UTC',
    },
    attendees: contact?.email ? [{ email: contact.email }] : undefined,
  };

  const generateMeet = appointmentType?.generate_google_meet &&
                       appointmentType?.location_type === 'google_meet';

  const result = await createGoogleEvent(
    connection.access_token,
    'primary',
    eventData,
    generateMeet
  );

  await supabase
    .from('appointment_sync')
    .upsert({
      org_id: appointment.org_id,
      appointment_id: appointmentId,
      provider: 'google',
      external_event_id: result.eventId,
      sync_status: 'synced',
    });

  if (result.meetLink) {
    await supabase
      .from('appointments')
      .update({ google_meet_link: result.meetLink })
      .eq('id', appointmentId);
  }

  return result;
}

export async function getValidAccessToken(
  connection: GoogleCalendarConnection,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const expiry = new Date(connection.token_expiry);
  const now = new Date();

  if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return connection.access_token;
  }

  const { access_token, expires_in } = await refreshAccessToken(
    connection.refresh_token,
    clientId,
    clientSecret
  );

  const newExpiry = new Date(Date.now() + expires_in * 1000).toISOString();

  await supabase
    .from('google_calendar_connections')
    .update({
      access_token,
      token_expiry: newExpiry,
    })
    .eq('id', connection.id);

  return access_token;
}
