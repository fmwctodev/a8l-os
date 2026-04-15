import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  handleCors,
  jsonResponse,
  errorResponse,
  successResponse,
} from "../_shared/cors.ts";
import {
  getSupabaseClient,
  extractUserContext,
  requireAuth,
} from "../_shared/auth.ts";

// ---------------------------------------------------------------------------
// SAM.gov API endpoints
// ---------------------------------------------------------------------------
const SAM_OPPORTUNITIES_URL =
  "https://api.sam.gov/opportunities/v2/search";
const SAM_PSC_URL =
  "https://api.sam.gov/prod/locationservices/v1/api/publicpscdetails";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = Deno.env.get("SAM_GOV_API_KEY");
  if (!key) {
    throw new Error("SAM_GOV_API_KEY environment variable is not set");
  }
  return key;
}

/** Format a JS Date to MM/dd/yyyy as required by SAM.gov */
function formatSamDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Convert a date string to SAM.gov's required MM/dd/yyyy format.
 * Accepts YYYY-MM-DD (from HTML date inputs) or MM/dd/yyyy (already correct).
 */
function toSamDateFormat(dateStr: string): string {
  if (dateStr.includes("/")) return dateStr; // already MM/dd/yyyy
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    return `${mm}/${dd}/${yyyy}`;
  }
  return dateStr; // fallback
}

/** Return today and 30 days ago as MM/dd/yyyy strings. */
function defaultDateRange(): { postedFrom: string; postedTo: string } {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    postedFrom: formatSamDate(thirtyDaysAgo),
    postedTo: formatSamDate(now),
  };
}

/**
 * Perform a fetch against SAM.gov with basic error handling.
 * Throws on HTTP errors and surfaces rate-limit responses.
 */
async function fetchSamApi(url: string): Promise<unknown> {
  console.log(`[sam-gov-api] Fetching: ${url.replace(/api_key=[^&]+/, "api_key=***")}`);

  const response = await fetch(url);

  if (response.status === 429) {
    throw new SamRateLimitError(
      "SAM.gov API rate limit exceeded. Non-federal users are limited to " +
        "10 requests per day. Please try again later."
    );
  }

  if (!response.ok) {
    const body = await response.text();
    console.error(`[sam-gov-api] SAM.gov responded ${response.status}: ${body}`);
    throw new Error(
      `SAM.gov API returned status ${response.status}: ${body.slice(0, 300)}`
    );
  }

  return response.json();
}

class SamRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SamRateLimitError";
  }
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

interface SearchOpportunitiesParams {
  keywords?: string;
  naicsCode?: string;
  pscCode?: string;
  setAsideType?: string;
  state?: string;
  agencyName?: string;
  procurementType?: string;
  postedFrom?: string;
  postedTo?: string;
  limit?: number;
  offset?: number;
}

async function searchOpportunities(
  params: SearchOpportunitiesParams
): Promise<unknown> {
  const apiKey = getApiKey();
  const defaults = defaultDateRange();

  const qp = new URLSearchParams();
  qp.set("api_key", apiKey);

  if (params.keywords) qp.set("q", params.keywords);
  if (params.naicsCode) qp.set("ncode", params.naicsCode);
  if (params.pscCode) qp.set("ccode", params.pscCode);
  if (params.setAsideType) qp.set("typeOfSetAside", params.setAsideType);
  if (params.state) qp.set("state", params.state);
  if (params.agencyName) qp.set("organizationName", params.agencyName);
  if (params.procurementType) qp.set("ptype", params.procurementType);

  qp.set("postedFrom", toSamDateFormat(params.postedFrom ?? defaults.postedFrom));
  qp.set("postedTo", toSamDateFormat(params.postedTo ?? defaults.postedTo));
  qp.set("limit", String(params.limit ?? 25));
  qp.set("offset", String(params.offset ?? 0));

  const url = `${SAM_OPPORTUNITIES_URL}?${qp.toString()}`;
  return fetchSamApi(url);
}

async function getOpportunity(noticeId: string): Promise<unknown> {
  if (!noticeId) {
    throw new Error("noticeId is required");
  }

  const apiKey = getApiKey();
  const url =
    `${SAM_OPPORTUNITIES_URL}?api_key=${apiKey}&noticeid=${encodeURIComponent(noticeId)}&limit=1`;

  const data = (await fetchSamApi(url)) as Record<string, unknown>;

  // The API returns opportunities inside opportunitiesData or similar wrapper
  const opportunities =
    (data.opportunitiesData as unknown[]) ?? (data as unknown[]);

  if (Array.isArray(opportunities) && opportunities.length > 0) {
    return opportunities[0];
  }

  throw new Error(`Opportunity with noticeId "${noticeId}" not found`);
}

interface SearchPscParams {
  query: string;
  active?: string;
  limit?: number;
}

async function searchPsc(params: SearchPscParams): Promise<unknown> {
  if (!params.query) {
    throw new Error("query is required for PSC search");
  }

  const apiKey = getApiKey();
  const active = params.active ?? "Y";
  const limit = params.limit ?? 25;
  const url =
    `${SAM_PSC_URL}?api_key=${apiKey}&q=${encodeURIComponent(params.query)}&active=${active}&limit=${limit}`;

  return fetchSamApi(url);
}

// ---------------------------------------------------------------------------
// Import opportunity into the CRM pipeline
// ---------------------------------------------------------------------------

interface SamOpportunityData {
  title?: string;
  solicitationNumber?: string;
  noticeId?: string;
  fullParentPathName?: string;
  type?: string;
  responseDeadLine?: string;
  postedDate?: string;
  naicsCode?: string;
  typeOfSetAside?: string;
  award?: { amount?: number };
  // Allow extra fields from the raw SAM.gov response
  [key: string]: unknown;
}

interface ImportOpportunityParams {
  samData: SamOpportunityData;
  contactId?: string;
}

async function importOpportunity(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
  params: ImportOpportunityParams
): Promise<{ opportunityId: string; contactId?: string }> {
  const { samData, contactId } = params;

  if (!samData || !samData.title) {
    throw new Error("samData with at least a title is required for import");
  }

  // 1. Find the "Government" pipeline for this org
  const { data: pipeline, error: pipelineErr } = await supabase
    .from("pipelines")
    .select("id")
    .eq("org_id", orgId)
    .eq("name", "Government")
    .maybeSingle();

  if (pipelineErr) {
    console.error("[sam-gov-api] Pipeline lookup error:", pipelineErr.message);
    throw new Error("Failed to find Government pipeline");
  }
  if (!pipeline) {
    throw new Error(
      'No "Government" pipeline found for this organization. ' +
        "Please create one before importing SAM.gov opportunities."
    );
  }

  // 2. Find the "Identified" stage
  const { data: stage, error: stageErr } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("pipeline_id", pipeline.id)
    .eq("name", "Identified")
    .maybeSingle();

  if (stageErr) {
    console.error("[sam-gov-api] Stage lookup error:", stageErr.message);
    throw new Error("Failed to find Identified stage");
  }
  if (!stage) {
    throw new Error(
      'No "Identified" stage found in the Government pipeline. ' +
        "Please add one before importing."
    );
  }

  // 3. Create or find contact from SAM.gov Point of Contact
  const pocArray = samData.pointOfContact as Array<{
    fullName?: string; email?: string; phone?: string; title?: string; type?: string;
  }> | undefined;
  const poc = pocArray?.find((p) => p.type === "primary") || pocArray?.[0];
  let resolvedContactId = contactId || null;

  if (!resolvedContactId && poc?.email) {
    // Check if a contact with this email already exists
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("email", poc.email.trim())
      .maybeSingle();

    if (existingContact) {
      resolvedContactId = existingContact.id;
      console.log(`[sam-gov-api] Found existing contact ${resolvedContactId} for POC ${poc.email}`);
    } else {
      // Create a new contact from the POC
      const nameParts = (poc.fullName || "Government POC").trim().split(/\s+/);
      const firstName = nameParts[0] || "Government";
      const lastName = nameParts.slice(1).join(" ") || "POC";

      const { data: newContact, error: contactErr } = await supabase
        .from("contacts")
        .insert({
          organization_id: orgId,
          first_name: firstName,
          last_name: lastName,
          email: poc.email.trim(),
          phone: poc.phone || null,
          job_title: poc.title || null,
          company: (samData.fullParentPathName as string) || (samData.department as string) || null,
          source: "sam_gov",
        })
        .select("id")
        .single();

      if (contactErr) {
        console.error("[sam-gov-api] Contact creation failed:", contactErr.message);
        // Don't fail the import — create opportunity without contact
      } else {
        resolvedContactId = newContact.id;
        console.log(`[sam-gov-api] Created new contact ${resolvedContactId} from POC ${poc.email}`);
      }
    }
  }

  // If still no contact, create a placeholder
  if (!resolvedContactId) {
    const placeholderName = (samData.fullParentPathName as string) || (samData.department as string) || "SAM.gov Opportunity";
    const { data: placeholderContact } = await supabase
      .from("contacts")
      .insert({
        organization_id: orgId,
        first_name: placeholderName.substring(0, 50),
        last_name: "POC",
        company: placeholderName,
        source: "sam_gov",
      })
      .select("id")
      .single();
    resolvedContactId = placeholderContact?.id || null;
  }

  if (!resolvedContactId) {
    throw new Error("Failed to create or find a contact for this opportunity");
  }

  // 4. Parse close date from SAM.gov responseDeadLine (date column, needs YYYY-MM-DD)
  let closeDate: string | null = null;
  if (samData.responseDeadLine) {
    try {
      const d = new Date(samData.responseDeadLine as string);
      closeDate = d.toISOString().split("T")[0]; // YYYY-MM-DD
    } catch {
      console.warn("[sam-gov-api] Could not parse responseDeadLine:", samData.responseDeadLine);
    }
  }

  // 5. Build rich description with all solicitation details
  const descParts: string[] = [];
  if (samData.description) descParts.push(String(samData.description));
  descParts.push("");
  descParts.push(`Solicitation: ${samData.solicitationNumber || "N/A"}`);
  descParts.push(`Agency: ${(samData.fullParentPathName as string) || (samData.department as string) || "N/A"}`);
  if (samData.naicsCode) descParts.push(`NAICS: ${samData.naicsCode}`);
  if (samData.classificationCode) descParts.push(`PSC: ${samData.classificationCode}`);
  if (samData.typeOfSetAsideDescription || samData.typeOfSetAside) {
    descParts.push(`Set-Aside: ${samData.typeOfSetAsideDescription || samData.typeOfSetAside}`);
  }
  if (samData.responseDeadLine) descParts.push(`Deadline: ${samData.responseDeadLine}`);
  if (samData.postedDate) descParts.push(`Posted: ${samData.postedDate}`);
  if (samData.type) descParts.push(`Type: ${samData.type}`);
  if (poc) {
    descParts.push("");
    descParts.push("Point of Contact:");
    if (poc.fullName) descParts.push(`  Name: ${poc.fullName}`);
    if (poc.email) descParts.push(`  Email: ${poc.email}`);
    if (poc.phone) descParts.push(`  Phone: ${poc.phone}`);
    if (poc.title) descParts.push(`  Title: ${poc.title}`);
  }
  if (samData.uiLink) {
    descParts.push("");
    descParts.push(`SAM.gov Link: ${samData.uiLink}`);
  }
  const description = descParts.join("\n");

  // 6. Create the opportunity record with all required fields
  const { data: opportunity, error: oppErr } = await supabase
    .from("opportunities")
    .insert({
      org_id: orgId,
      pipeline_id: pipeline.id,
      stage_id: stage.id,
      contact_id: resolvedContactId,
      created_by: userId,
      name: samData.title,
      description: description,
      value_amount: samData.award?.amount ?? 0,
      source: "sam_gov",
      close_date: closeDate,
      status: "open",
    })
    .select("id")
    .single();

  if (oppErr) {
    console.error("[sam-gov-api] Opportunity insert error:", oppErr.message);
    throw new Error(`Failed to create opportunity: ${oppErr.message}`);
  }

  // 7. Create the gov_opportunity_imports audit record with full SAM.gov snapshot
  // sam_notice_id is NOT NULL — use noticeId or solicitationNumber as fallback
  const noticeIdValue = samData.noticeId || samData.solicitationNumber || `import-${Date.now()}`;

  // sam_posted_date and sam_response_deadline are timestamptz — parse into ISO strings
  let samPostedDate: string | null = null;
  let samResponseDeadline: string | null = null;
  try { if (samData.postedDate) samPostedDate = new Date(samData.postedDate as string).toISOString(); } catch { /* skip */ }
  try { if (samData.responseDeadLine) samResponseDeadline = new Date(samData.responseDeadLine as string).toISOString(); } catch { /* skip */ }

  const { error: importErr } = await supabase
    .from("gov_opportunity_imports")
    .insert({
      org_id: orgId,
      opportunity_id: opportunity.id,
      sam_notice_id: noticeIdValue,
      sam_solicitation_number: samData.solicitationNumber ?? null,
      sam_title: samData.title ?? null,
      sam_agency: (samData.fullParentPathName as string) ?? null,
      sam_posted_date: samPostedDate,
      sam_response_deadline: samResponseDeadline,
      sam_set_aside: samData.typeOfSetAside ?? null,
      sam_naics_code: samData.naicsCode ?? null,
      sam_type: samData.type ?? null,
      sam_data: samData,
      imported_by: userId,
    });

  if (importErr) {
    console.error("[sam-gov-api] gov_opportunity_imports insert error:", importErr.message);
  }

  // 8. Create a timeline event on the opportunity
  try {
    await supabase.from("activity_log").insert({
      organization_id: orgId,
      user_id: userId,
      entity_type: "opportunity",
      entity_id: opportunity.id,
      event_type: "imported",
      summary: `Imported from SAM.gov: ${samData.solicitationNumber || samData.noticeId || "N/A"}`,
      payload: {
        source: "sam_gov",
        notice_id: samData.noticeId,
        solicitation_number: samData.solicitationNumber,
        agency: samData.fullParentPathName,
      },
    });
  } catch { /* activity log is non-critical */ }

  console.log(`[sam-gov-api] Imported SAM.gov opportunity ${samData.noticeId} as ${opportunity.id} (contact: ${resolvedContactId})`);

  return { opportunityId: opportunity.id, contactId: resolvedContactId };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate the caller
    const supabase = getSupabaseClient();
    const userContext = await extractUserContext(req, supabase);
    const user = requireAuth(userContext);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;

    if (!action) {
      return errorResponse(
        "MISSING_ACTION",
        'Request body must include an "action" field',
        400
      );
    }

    console.log(
      `[sam-gov-api] Action: ${action} | User: ${user.id} | Org: ${user.orgId}`
    );

    switch (action) {
      // ---------------------------------------------------------------
      case "search-opportunities": {
        const result = await searchOpportunities({
          keywords: body.keywords,
          naicsCode: body.naicsCode,
          pscCode: body.pscCode,
          setAsideType: body.setAsideType,
          state: body.state,
          agencyName: body.agencyName,
          procurementType: body.procurementType,
          postedFrom: body.postedFrom,
          postedTo: body.postedTo,
          limit: body.limit,
          offset: body.offset,
        });
        return successResponse(result);
      }

      // ---------------------------------------------------------------
      case "get-opportunity": {
        const noticeId = body.noticeId as string | undefined;
        if (!noticeId) {
          return errorResponse(
            "MISSING_NOTICE_ID",
            "noticeId is required for get-opportunity",
            400
          );
        }
        const result = await getOpportunity(noticeId);
        return successResponse(result);
      }

      // ---------------------------------------------------------------
      case "search-psc": {
        const result = await searchPsc({
          query: body.query,
          active: body.active,
          limit: body.limit,
        });
        return successResponse(result);
      }

      // ---------------------------------------------------------------
      case "import-opportunity": {
        if (!body.samData) {
          return errorResponse(
            "MISSING_SAM_DATA",
            "samData object is required for import-opportunity",
            400
          );
        }
        const result = await importOpportunity(supabase, user.orgId, user.id, {
          samData: body.samData,
          contactId: body.contactId,
        });
        return successResponse(result);
      }

      // ---------------------------------------------------------------
      default:
        return errorResponse(
          "UNKNOWN_ACTION",
          `Unknown action: "${action}". ` +
            "Supported actions: search-opportunities, get-opportunity, search-psc, import-opportunity",
          400
        );
    }
  } catch (error) {
    const err = error as Error;
    console.error(`[sam-gov-api] Error: ${err.message}`, err.stack);

    if (err.name === "AuthError") {
      return errorResponse("AUTH_ERROR", err.message, 401);
    }

    if (err.name === "SamRateLimitError") {
      return errorResponse("RATE_LIMIT", err.message, 429);
    }

    return errorResponse(
      "INTERNAL_ERROR",
      err.message || "An unexpected error occurred",
      500
    );
  }
});
