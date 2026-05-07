import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  addMailgunUnsubscribe,
  getDecryptedMailgunCreds,
  listMailgunSuppressions,
  removeMailgunUnsubscribe,
} from "../_shared/mailgun.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Mailgun has no concept of named "unsubscribe groups" — there is a single
 * per-domain suppression list (with optional tags) for unsubscribes, plus
 * separate bounces and complaints lists.
 *
 * To preserve compatibility with the existing frontend, the "list/create/
 * update/set-default/delete/sync" actions act on the local
 * `email_unsubscribe_groups` rows as labels. The new "list-suppressions"/
 * "add-suppression"/"remove-suppression" actions act on the live Mailgun
 * suppression API.
 *
 * The local row's `provider_group_id` becomes a free-form Mailgun tag.
 */

interface ListRequest {
  action: "list";
}

interface CreateRequest {
  action: "create";
  name: string;
  description?: string;
  tag?: string;
}

interface UpdateRequest {
  action: "update";
  groupId: string;
  name?: string;
  description?: string;
  tag?: string;
}

interface SetDefaultRequest {
  action: "set-default";
  groupId: string;
}

interface DeleteRequest {
  action: "delete";
  groupId: string;
}

interface SyncRequest {
  action: "sync";
}

interface ListSuppressionsRequest {
  action: "list-suppressions";
  kind?: "unsubscribes" | "bounces" | "complaints";
}

interface AddSuppressionRequest {
  action: "add-suppression";
  address: string;
  tag?: string;
}

interface RemoveSuppressionRequest {
  action: "remove-suppression";
  address: string;
}

type RequestPayload =
  | ListRequest
  | CreateRequest
  | UpdateRequest
  | SetDefaultRequest
  | DeleteRequest
  | SyncRequest
  | ListSuppressionsRequest
  | AddSuppressionRequest
  | RemoveSuppressionRequest;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: hasPermission } = await supabase.rpc("user_has_email_permission", {
      user_id: user.id,
      required_permission: "email.settings.manage",
    });

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const orgId = userData.organization_id;
    const payload: RequestPayload = await req.json();

    if (payload.action === "list") {
      const { data: groups } = await supabase
        .from("email_unsubscribe_groups")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });

      return new Response(
        JSON.stringify({ success: true, groups: groups ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "create") {
      const { data: existingGroups } = await supabase
        .from("email_unsubscribe_groups")
        .select("id")
        .eq("org_id", orgId);

      const isFirst = !existingGroups || existingGroups.length === 0;

      const { data: group, error: insertError } = await supabase
        .from("email_unsubscribe_groups")
        .insert({
          org_id: orgId,
          provider_group_id: payload.tag ?? null,
          name: payload.name,
          description: payload.description || null,
          is_default: isFirst,
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Failed to save unsubscribe group" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (isFirst) {
        await supabase
          .from("email_defaults")
          .upsert({ org_id: orgId, default_unsubscribe_group_id: group.id }, { onConflict: "org_id" });
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.unsubscribe_group.created",
        entity_type: "email_unsubscribe_group",
        entity_id: group.id,
        details: { name: payload.name, tag: payload.tag, provider: "mailgun" },
      });

      return new Response(
        JSON.stringify({ success: true, group }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "update") {
      const { data: group } = await supabase
        .from("email_unsubscribe_groups")
        .select("id, name")
        .eq("id", payload.groupId)
        .eq("org_id", orgId)
        .single();

      if (!group) {
        return new Response(
          JSON.stringify({ error: "Unsubscribe group not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const updates: Record<string, unknown> = {};
      if (payload.name) updates.name = payload.name;
      if (payload.description !== undefined) updates.description = payload.description || null;
      if (payload.tag !== undefined) updates.provider_group_id = payload.tag || null;

      const { error: updateError } = await supabase
        .from("email_unsubscribe_groups")
        .update(updates)
        .eq("id", payload.groupId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to update unsubscribe group" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "set-default") {
      const { data: group } = await supabase
        .from("email_unsubscribe_groups")
        .select("id")
        .eq("id", payload.groupId)
        .eq("org_id", orgId)
        .single();

      if (!group) {
        return new Response(
          JSON.stringify({ error: "Unsubscribe group not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase
        .from("email_unsubscribe_groups")
        .update({ is_default: false })
        .eq("org_id", orgId);

      await supabase
        .from("email_unsubscribe_groups")
        .update({ is_default: true })
        .eq("id", payload.groupId);

      await supabase
        .from("email_defaults")
        .upsert(
          { org_id: orgId, default_unsubscribe_group_id: payload.groupId },
          { onConflict: "org_id" },
        );

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "delete") {
      const { data: group } = await supabase
        .from("email_unsubscribe_groups")
        .select("id, name, is_default")
        .eq("id", payload.groupId)
        .eq("org_id", orgId)
        .single();

      if (!group) {
        return new Response(
          JSON.stringify({ error: "Unsubscribe group not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (group.is_default) {
        return new Response(
          JSON.stringify({ error: "Cannot delete default unsubscribe group" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: deleteError } = await supabase
        .from("email_unsubscribe_groups")
        .delete()
        .eq("id", payload.groupId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: "Failed to delete unsubscribe group" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.unsubscribe_group.deleted",
        entity_type: "email_unsubscribe_group",
        entity_id: payload.groupId,
        details: { name: group.name },
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "sync") {
      // No-op for Mailgun: groups are local labels, not synced from a remote
      // group catalog.
      const { data: groups } = await supabase
        .from("email_unsubscribe_groups")
        .select("id")
        .eq("org_id", orgId);

      return new Response(
        JSON.stringify({ success: true, synced: groups?.length ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (
      payload.action === "list-suppressions" ||
      payload.action === "add-suppression" ||
      payload.action === "remove-suppression"
    ) {
      const creds = await getDecryptedMailgunCreds(orgId, supabase, supabaseUrl, serviceRoleKey);
      if (!creds) {
        return new Response(
          JSON.stringify({ error: "Mailgun not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (payload.action === "list-suppressions") {
        const result = await listMailgunSuppressions(
          creds.apiKey,
          creds.domain,
          payload.kind ?? "unsubscribes",
          creds.region,
        );
        if (!result.ok) {
          return new Response(
            JSON.stringify({ error: result.error || "Failed to list suppressions" }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ success: true, items: result.items }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (payload.action === "add-suppression") {
        const result = await addMailgunUnsubscribe(
          creds.apiKey,
          creds.domain,
          payload.address,
          payload.tag ?? null,
          creds.region,
        );
        if (!result.ok) {
          return new Response(
            JSON.stringify({ error: result.error || "Failed to add suppression" }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (payload.action === "remove-suppression") {
        const result = await removeMailgunUnsubscribe(
          creds.apiKey,
          creds.domain,
          payload.address,
          creds.region,
        );
        if (!result.ok) {
          return new Response(
            JSON.stringify({ error: result.error || "Failed to remove suppression" }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
