// GHL → BuilderLync (or any org) one-shot importer.
//
// Cursor-based to handle 5k–50k contacts within the 150s edge function
// budget. Each invocation processes one chunk and returns `done` plus
// a cursor to resume. Frontend loops until `done=true`.
//
// Phases:
//   1. contacts  — paginated by GHL `startAfterId`, ~250 contacts/chunk
//                  also writes notes + custom field values per contact
//   2. opportunities — paginated by GHL search cursor
//   3. appointments — paginated; gracefully skips if no calendar set up
//   4. done
//
// Idempotency: each insert checks for existing row by ghl_*_id column.
// Re-runs are safe.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GHL_API = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

interface ImportRequest {
  action: "import";
  ghl_token: string;
  ghl_location_id: string;
  importer_user_id: string;
  target_org_id: string;
  cursor?: string | null;
  phase?: "contacts" | "opportunities" | "appointments" | "done";
  // Per-phase progress carried across chunks.
  progress?: ImportProgress;
}

interface ImportProgress {
  contacts_processed: number;
  notes_processed: number;
  custom_field_values_processed: number;
  opportunities_processed: number;
  appointments_processed: number;
  errors: string[];
  contact_id_map?: Record<string, string>; // GHL ID → our UUID, used by later phases
  custom_field_map?: Record<string, string>; // GHL field key → our UUID
  pipeline_map?: Record<string, { pipeline_id: string; stages: Record<string, string> }>; // GHL pipeline_id → ours
}

function newProgress(): ImportProgress {
  return {
    contacts_processed: 0,
    notes_processed: 0,
    custom_field_values_processed: 0,
    opportunities_processed: 0,
    appointments_processed: 0,
    errors: [],
    contact_id_map: {},
    custom_field_map: {},
    pipeline_map: {},
  };
}

async function ghlGet<T = unknown>(
  token: string,
  path: string,
): Promise<{ ok: boolean; data?: T; status: number; error?: string }> {
  try {
    const res = await fetch(`${GHL_API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: GHL_VERSION,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 300) };
    }
    return { ok: true, status: res.status, data: (await res.json()) as T };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

interface GhlContact {
  id: string;
  firstName?: string;
  lastName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  source?: string;
  dnd?: boolean;
  customFields?: Array<{ id: string; key?: string; field_value?: unknown; value?: unknown }>;
  tags?: string[];
  dateAdded?: string;
}

interface GhlNote {
  id: string;
  body: string;
  dateAdded?: string;
  userId?: string;
}

interface GhlOpportunity {
  id: string;
  name?: string;
  monetaryValue?: number;
  pipelineId: string;
  pipelineStageId: string;
  status?: string;
  source?: string;
  contactId?: string;
  contact?: { id: string };
  createdAt?: string;
  updatedAt?: string;
}

interface GhlAppointment {
  id: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  contactId?: string;
  calendarId?: string;
  appointmentStatus?: string;
  notes?: string;
  address?: string;
}

// deno-lint-ignore no-explicit-any
type Supabase = any;

async function ensureCustomField(
  supabase: Supabase,
  orgId: string,
  ghlField: { id: string; key?: string; name?: string },
  customFieldMap: Record<string, string>,
): Promise<string | null> {
  if (customFieldMap[ghlField.id]) return customFieldMap[ghlField.id];

  const fieldKey = (ghlField.key || ghlField.id || "ghl_field").replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  const name = ghlField.name || ghlField.key || `GHL field ${ghlField.id.slice(0, 6)}`;

  // Check if already exists
  const { data: existing } = await supabase
    .from("custom_fields")
    .select("id")
    .eq("organization_id", orgId)
    .eq("field_key", fieldKey)
    .eq("scope", "contact")
    .maybeSingle();

  if (existing) {
    customFieldMap[ghlField.id] = existing.id;
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("custom_fields")
    .insert({
      organization_id: orgId,
      name,
      field_key: fieldKey,
      field_type: "text",
      scope: "contact",
    })
    .select("id")
    .single();

  if (error || !created) return null;
  customFieldMap[ghlField.id] = created.id;
  return created.id;
}

async function ensurePipeline(
  supabase: Supabase,
  orgId: string,
  ghlPipelineId: string,
  ghlPipelineName: string,
  ghlStages: Array<{ id: string; name: string; position?: number }>,
  pipelineMap: Record<string, { pipeline_id: string; stages: Record<string, string> }>,
): Promise<{ pipeline_id: string; stages: Record<string, string> } | null> {
  if (pipelineMap[ghlPipelineId]) return pipelineMap[ghlPipelineId];

  const { data: existing } = await supabase
    .from("pipelines")
    .select("id")
    .eq("org_id", orgId)
    .eq("name", ghlPipelineName)
    .maybeSingle();

  let pipelineId: string;
  if (existing) {
    pipelineId = existing.id;
  } else {
    const { data: created, error } = await supabase
      .from("pipelines")
      .insert({ org_id: orgId, name: ghlPipelineName })
      .select("id")
      .single();
    if (error || !created) return null;
    pipelineId = created.id;
  }

  const stageMap: Record<string, string> = {};
  for (const stage of ghlStages) {
    const { data: existingStage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("org_id", orgId)
      .eq("pipeline_id", pipelineId)
      .eq("name", stage.name)
      .maybeSingle();
    if (existingStage) {
      stageMap[stage.id] = existingStage.id;
    } else {
      const { data: createdStage } = await supabase
        .from("pipeline_stages")
        .insert({
          org_id: orgId,
          pipeline_id: pipelineId,
          name: stage.name,
          sort_order: stage.position ?? 0,
        })
        .select("id")
        .single();
      if (createdStage) stageMap[stage.id] = createdStage.id;
    }
  }

  pipelineMap[ghlPipelineId] = { pipeline_id: pipelineId, stages: stageMap };
  return pipelineMap[ghlPipelineId];
}

async function processContactsChunk(
  supabase: Supabase,
  payload: ImportRequest,
  progress: ImportProgress,
): Promise<{ next_cursor: string | null; phase_done: boolean }> {
  const limit = 100;
  const url = `/contacts/?locationId=${encodeURIComponent(payload.ghl_location_id)}&limit=${limit}${
    payload.cursor ? `&startAfterId=${encodeURIComponent(payload.cursor)}` : ""
  }`;

  const result = await ghlGet<{ contacts: GhlContact[]; meta?: { total?: number } }>(
    payload.ghl_token,
    url,
  );

  if (!result.ok || !result.data) {
    progress.errors.push(`contacts list ${result.status}: ${result.error}`);
    return { next_cursor: null, phase_done: true };
  }

  const contacts = result.data.contacts ?? [];
  if (contacts.length === 0) return { next_cursor: null, phase_done: true };

  const startTime = Date.now();
  const TIMEOUT_BUDGET_MS = 100_000; // leave 50s buffer under the 150s limit

  for (const ghl of contacts) {
    if (Date.now() - startTime > TIMEOUT_BUDGET_MS) {
      // Return early with cursor so frontend can resume
      return { next_cursor: ghl.id, phase_done: false };
    }

    try {
      // Idempotency check
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("organization_id", payload.target_org_id)
        .eq("ghl_contact_id", ghl.id)
        .maybeSingle();

      let contactId: string;
      if (existing) {
        contactId = existing.id;
      } else {
        const { data: created, error } = await supabase
          .from("contacts")
          .insert({
            organization_id: payload.target_org_id,
            first_name: ghl.firstName || ghl.contactName?.split(" ")[0] || "Unknown",
            last_name: ghl.lastName || ghl.contactName?.split(" ").slice(1).join(" ") || "",
            email: ghl.email || null,
            phone: ghl.phone || null,
            company: ghl.companyName || null,
            address_line1: ghl.address1 || null,
            city: ghl.city || null,
            state: ghl.state || null,
            postal_code: ghl.postalCode || null,
            country: ghl.country || null,
            source: ghl.source || "ghl_migration",
            ghl_contact_id: ghl.id,
            created_by_user_id: payload.importer_user_id,
            last_activity_at: ghl.dateAdded || new Date().toISOString(),
          })
          .select("id")
          .single();

        if (error || !created) {
          progress.errors.push(`contact ${ghl.id}: ${error?.message || "insert failed"}`);
          continue;
        }
        contactId = created.id;
        progress.contacts_processed++;
      }

      progress.contact_id_map![ghl.id] = contactId;

      // Custom fields
      if (ghl.customFields && ghl.customFields.length > 0) {
        for (const cf of ghl.customFields) {
          const fieldId = await ensureCustomField(
            supabase,
            payload.target_org_id,
            { id: cf.id, key: cf.key },
            progress.custom_field_map!,
          );
          if (!fieldId) continue;
          const value = cf.value ?? cf.field_value ?? null;
          if (value === null || value === undefined || value === "") continue;
          await supabase
            .from("contact_custom_field_values")
            .upsert(
              { contact_id: contactId, custom_field_id: fieldId, value: typeof value === "string" ? value : JSON.stringify(value) },
              { onConflict: "contact_id,custom_field_id" },
            );
          progress.custom_field_values_processed++;
        }
      }

      // Notes — fetch per contact
      const notesRes = await ghlGet<{ notes: GhlNote[] }>(
        payload.ghl_token,
        `/contacts/${ghl.id}/notes`,
      );
      if (notesRes.ok && notesRes.data?.notes) {
        for (const note of notesRes.data.notes) {
          if (!note.body) continue;
          // Idempotency on notes: check if a note with this source_id already exists
          const { data: existingNote } = await supabase
            .from("contact_notes")
            .select("id")
            .eq("contact_id", contactId)
            .eq("source_type", "ghl")
            .eq("source_id", note.id)
            .maybeSingle();
          if (existingNote) continue;

          await supabase.from("contact_notes").insert({
            contact_id: contactId,
            user_id: payload.importer_user_id,
            content: note.body.slice(0, 10000),
            source_type: "ghl",
            source_id: note.id,
            metadata: { ghl_user_id: note.userId, ghl_date_added: note.dateAdded },
          });
          progress.notes_processed++;
        }
      }
    } catch (e) {
      progress.errors.push(`contact ${ghl.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // If we got fewer than the limit, we're done
  if (contacts.length < limit) return { next_cursor: null, phase_done: true };

  // Otherwise continue from the last contact's ID
  return { next_cursor: contacts[contacts.length - 1].id, phase_done: false };
}

async function processOpportunitiesChunk(
  supabase: Supabase,
  payload: ImportRequest,
  progress: ImportProgress,
): Promise<{ next_cursor: string | null; phase_done: boolean }> {
  const limit = 100;
  // GHL opportunities search uses `?location_id=`. Some endpoints use `startAfter`.
  const cursorParam = payload.cursor ? `&startAfter=${encodeURIComponent(payload.cursor)}` : "";
  const url = `/opportunities/search?location_id=${encodeURIComponent(payload.ghl_location_id)}&limit=${limit}${cursorParam}`;

  const result = await ghlGet<{
    opportunities: GhlOpportunity[];
    meta?: { startAfter?: string; total?: number };
  }>(payload.ghl_token, url);

  if (!result.ok || !result.data) {
    progress.errors.push(`opportunities ${result.status}: ${result.error}`);
    return { next_cursor: null, phase_done: true };
  }

  const opps = result.data.opportunities ?? [];
  if (opps.length === 0) return { next_cursor: null, phase_done: true };

  // First, ensure pipelines exist by listing them
  const pipelinesRes = await ghlGet<{ pipelines: Array<{ id: string; name: string; stages?: Array<{ id: string; name: string; position?: number }> }> }>(
    payload.ghl_token,
    `/opportunities/pipelines?locationId=${encodeURIComponent(payload.ghl_location_id)}`,
  );
  if (pipelinesRes.ok && pipelinesRes.data?.pipelines) {
    for (const pl of pipelinesRes.data.pipelines) {
      await ensurePipeline(
        supabase,
        payload.target_org_id,
        pl.id,
        pl.name,
        pl.stages ?? [],
        progress.pipeline_map!,
      );
    }
  }

  for (const opp of opps) {
    try {
      const ghlContactId = opp.contactId || opp.contact?.id;
      if (!ghlContactId) continue;
      const ourContactId = progress.contact_id_map?.[ghlContactId];
      if (!ourContactId) {
        // Try DB lookup as fallback
        const { data: c } = await supabase
          .from("contacts")
          .select("id")
          .eq("organization_id", payload.target_org_id)
          .eq("ghl_contact_id", ghlContactId)
          .maybeSingle();
        if (!c) continue;
        progress.contact_id_map![ghlContactId] = c.id;
      }
      const contactId = progress.contact_id_map![ghlContactId];

      const pl = progress.pipeline_map?.[opp.pipelineId];
      if (!pl) continue;
      const stageId = pl.stages[opp.pipelineStageId];
      if (!stageId) continue;

      const { data: existing } = await supabase
        .from("opportunities")
        .select("id")
        .eq("org_id", payload.target_org_id)
        .eq("ghl_opportunity_id", opp.id)
        .maybeSingle();
      if (existing) continue;

      const status = ((s) => {
        if (!s) return "open";
        const lower = s.toLowerCase();
        if (lower === "won") return "closed_won";
        if (lower === "lost") return "closed_lost";
        if (lower === "abandoned") return "closed_lost";
        return "open";
      })(opp.status);

      await supabase.from("opportunities").insert({
        org_id: payload.target_org_id,
        contact_id: contactId,
        pipeline_id: pl.pipeline_id,
        stage_id: stageId,
        value_amount: opp.monetaryValue ?? 0,
        currency: "USD",
        status,
        source: opp.source || "ghl_migration",
        name: opp.name || "Imported from GHL",
        created_by: payload.importer_user_id,
        ghl_opportunity_id: opp.id,
      });
      progress.opportunities_processed++;
    } catch (e) {
      progress.errors.push(`opportunity ${opp.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (opps.length < limit) return { next_cursor: null, phase_done: true };
  return { next_cursor: opps[opps.length - 1].id, phase_done: false };
}

async function processAppointmentsChunk(
  supabase: Supabase,
  payload: ImportRequest,
  progress: ImportProgress,
): Promise<{ next_cursor: string | null; phase_done: boolean }> {
  // Appointments need a calendar_id + appointment_type_id which BL likely
  // doesn't have set up yet. Check; if no calendars, skip with a recorded note.
  const { data: calendars } = await supabase
    .from("calendars")
    .select("id")
    .eq("org_id", payload.target_org_id)
    .limit(1);

  if (!calendars || calendars.length === 0) {
    progress.errors.push(
      "appointments skipped: no calendar configured for this org. Create a calendar in Settings → Calendars first, then re-run import.",
    );
    return { next_cursor: null, phase_done: true };
  }

  // Skipping the actual import for V1 — calendar setup is non-trivial.
  // Documented as a follow-up.
  progress.errors.push("appointments import not implemented in V1 (calendar mapping pending)");
  return { next_cursor: null, phase_done: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload: ImportRequest = await req.json();
    if (
      !payload.ghl_token ||
      !payload.ghl_location_id ||
      !payload.importer_user_id ||
      !payload.target_org_id
    ) {
      return jsonResponse(
        { error: "Missing required fields: ghl_token, ghl_location_id, importer_user_id, target_org_id" },
        400,
      );
    }

    const phase: ImportRequest["phase"] = payload.phase ?? "contacts";
    const progress: ImportProgress = payload.progress ?? newProgress();
    // ensure maps exist (lost across JSON serialization if frontend strips them)
    progress.contact_id_map = progress.contact_id_map ?? {};
    progress.custom_field_map = progress.custom_field_map ?? {};
    progress.pipeline_map = progress.pipeline_map ?? {};

    let result: { next_cursor: string | null; phase_done: boolean };
    if (phase === "contacts") {
      result = await processContactsChunk(supabase, payload, progress);
    } else if (phase === "opportunities") {
      result = await processOpportunitiesChunk(supabase, payload, progress);
    } else if (phase === "appointments") {
      result = await processAppointmentsChunk(supabase, payload, progress);
    } else {
      return jsonResponse({ done: true, phase: "done", progress });
    }

    let nextPhase: ImportRequest["phase"] = phase;
    let nextCursor: string | null = result.next_cursor;
    if (result.phase_done) {
      if (phase === "contacts") nextPhase = "opportunities";
      else if (phase === "opportunities") nextPhase = "appointments";
      else if (phase === "appointments") nextPhase = "done";
      nextCursor = null;
    }

    return jsonResponse({
      done: nextPhase === "done",
      phase: nextPhase,
      cursor: nextCursor,
      progress,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
