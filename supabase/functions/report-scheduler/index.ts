import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReportSchedule {
  id: string;
  organization_id: string;
  report_id: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  timezone: string;
  recipients: {
    user_ids: string[];
    emails: string[];
  };
  report: {
    id: string;
    name: string;
    data_source: string;
    config: Record<string, unknown>;
  };
}

function calculateNextRun(
  cadence: string,
  timeOfDay: string,
  dayOfWeek: number | null,
  dayOfMonth: number | null
): Date {
  const now = new Date();
  const [hours, minutes] = timeOfDay.split(':').map(Number);

  const next = new Date();
  next.setHours(hours, minutes, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  switch (cadence) {
    case 'daily':
      break;

    case 'weekly':
      if (dayOfWeek !== null) {
        const currentDay = next.getDay();
        const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
        if (daysUntilTarget === 0 && next <= now) {
          next.setDate(next.getDate() + 7);
        } else {
          next.setDate(next.getDate() + daysUntilTarget);
        }
      }
      break;

    case 'monthly':
      if (dayOfMonth !== null) {
        next.setDate(dayOfMonth);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        if (dayOfMonth > lastDay) {
          next.setDate(lastDay);
        }
      }
      break;
  }

  return next;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    const { data: dueSchedules, error: fetchError } = await supabase
      .from('report_schedules')
      .select(`
        id,
        organization_id,
        report_id,
        cadence,
        day_of_week,
        day_of_month,
        time_of_day,
        timezone,
        recipients,
        report:reports(id, name, data_source, config)
      `)
      .eq('enabled', true)
      .lte('next_run_at', now)
      .order('next_run_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      throw new Error(`Failed to fetch schedules: ${fetchError.message}`);
    }

    if (!dueSchedules || dueSchedules.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No due schedules', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ scheduleId: string; status: string; error?: string }> = [];

    for (const scheduleData of dueSchedules) {
      const schedule = scheduleData as unknown as ReportSchedule;

      try {
        const { data: reportRun, error: runError } = await supabase
          .from('report_runs')
          .insert({
            organization_id: schedule.organization_id,
            report_id: schedule.report_id,
            triggered_by: 'schedule',
            status: 'running',
          })
          .select()
          .single();

        if (runError) {
          throw new Error(`Failed to create report run: ${runError.message}`);
        }

        const { data: exportJob, error: exportError } = await supabase
          .from('report_exports')
          .insert({
            organization_id: schedule.organization_id,
            report_run_id: reportRun.id,
            status: 'queued',
            expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single();

        if (exportError) {
          throw new Error(`Failed to create export job: ${exportError.message}`);
        }

        const allEmails: string[] = [...schedule.recipients.emails];

        if (schedule.recipients.user_ids.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('email')
            .in('id', schedule.recipients.user_ids);

          if (users) {
            allEmails.push(...users.map(u => u.email));
          }
        }

        for (const email of allEmails) {
          await supabase
            .from('report_email_queue')
            .insert({
              organization_id: schedule.organization_id,
              schedule_id: schedule.id,
              report_run_id: reportRun.id,
              recipient_email: email,
              status: 'pending',
            });
        }

        const nextRunAt = calculateNextRun(
          schedule.cadence,
          schedule.time_of_day,
          schedule.day_of_week,
          schedule.day_of_month
        );

        await supabase
          .from('report_schedules')
          .update({
            last_run_at: now,
            next_run_at: nextRunAt.toISOString(),
            updated_at: now,
          })
          .eq('id', schedule.id);

        results.push({ scheduleId: schedule.id, status: 'success' });
      } catch (error) {
        console.error(`Error processing schedule ${schedule.id}:`, error);
        results.push({
          scheduleId: schedule.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scheduler error:', error);

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
