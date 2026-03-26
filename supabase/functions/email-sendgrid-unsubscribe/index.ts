import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ListRequest {
  action: "list";
}

interface CreateRequest {
  action: "create";
  name: string;
  description?: string;
}

interface UpdateRequest {
  action: "update";
  groupId: string;
  name?: string;
  description?: string;
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

type RequestPayload = ListRequest | CreateRequest | UpdateRequest | SetDefaultRequest | DeleteRequest | SyncRequest;

async function getDecryptedApiKey(
  orgId: string,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<string | null> {
  const envKey = Deno.env.get("SENDGRID_API_KEY");
  if (envKey) return envKey;

  const { data: conn } = await supabase
    .from("integration_connections")
    .select("credentials_encrypted, credentials_iv, status, integrations!inner(key)")
    .eq("org_id", orgId)
    .eq("integrations.key", "sendgrid")
    .maybeSingle();

  if (!conn || conn.status !== "connected" || !conn.credentials_encrypted || !conn.credentials_iv) {
    return null;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/email-crypto`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "decrypt",
      encrypted: conn.credentials_encrypted,
      iv: conn.credentials_iv,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.plaintext;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: hasPermission } = await supabase.rpc("user_has_email_permission", {
      user_id: user.id,
      required_permission: "email.settings.manage",
    });

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = userData.organization_id;
    const apiKey = await getDecryptedApiKey(orgId, supabase, supabaseUrl, serviceRoleKey);

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "SendGrid not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: RequestPayload = await req.json();

    if (payload.action === "list") {
      const sgResponse = await fetch("https://api.sendgrid.com/v3/asm/groups", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!sgResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch unsubscribe groups from SendGrid" }),
          { status: sgResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const groups = await sgResponse.json();
      return new Response(
        JSON.stringify({ success: true, groups }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "create") {
      const sgResponse = await fetch("https://api.sendgrid.com/v3/asm/groups", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: payload.name,
          description: payload.description || "",
        }),
      });

      if (!sgResponse.ok) {
        const errorData = await sgResponse.json();
        return new Response(
          JSON.stringify({ error: errorData.errors?.[0]?.message || "Failed to create unsubscribe group" }),
          { status: sgResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sgGroup = await sgResponse.json();

      const { data: existingGroups } = await supabase
        .from("email_unsubscribe_groups")
        .select("id")
        .eq("org_id", orgId);

      const isFirst = !existingGroups || existingGroups.length === 0;

      const { data: group, error: insertError } = await supabase
        .from("email_unsubscribe_groups")
        .insert({
          org_id: orgId,
          sendgrid_group_id: String(sgGroup.id),
          name: sgGroup.name,
          description: sgGroup.description || null,
          is_default: isFirst,
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Failed to save unsubscribe group" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (isFirst) {
        await supabase
          .from("email_defaults")
          .update({ default_unsubscribe_group_id: group.id })
          .eq("org_id", orgId);
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.unsubscribe_group.created",
        entity_type: "email_unsubscribe_group",
        entity_id: group.id,
        details: { name: payload.name },
      });

      return new Response(
        JSON.stringify({ success: true, group }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "update") {
      const { data: group } = await supabase
        .from("email_unsubscribe_groups")
        .select("id, sendgrid_group_id, name")
        .eq("id", payload.groupId)
        .eq("org_id", orgId)
        .single();

      if (!group) {
        return new Response(
          JSON.stringify({ error: "Unsubscribe group not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sgBody: Record<string, string> = {};
      if (payload.name) sgBody.name = payload.name;
      if (payload.description !== undefined) sgBody.description = payload.description;

      const sgResponse = await fetch(
        `https://api.sendgrid.com/v3/asm/groups/${group.sendgrid_group_id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sgBody),
        }
      );

      if (!sgResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to update unsubscribe group in SendGrid" }),
          { status: sgResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updates: Record<string, unknown> = {};
      if (payload.name) updates.name = payload.name;
      if (payload.description !== undefined) updates.description = payload.description || null;

      await supabase
        .from("email_unsubscribe_groups")
        .update(updates)
        .eq("id", payload.groupId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        .update({ default_unsubscribe_group_id: payload.groupId })
        .eq("org_id", orgId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "delete") {
      const { data: group } = await supabase
        .from("email_unsubscribe_groups")
        .select("id, sendgrid_group_id, name, is_default")
        .eq("id", payload.groupId)
        .eq("org_id", orgId)
        .single();

      if (!group) {
        return new Response(
          JSON.stringify({ error: "Unsubscribe group not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (group.is_default) {
        return new Response(
          JSON.stringify({ error: "Cannot delete default unsubscribe group" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await fetch(
        `https://api.sendgrid.com/v3/asm/groups/${group.sendgrid_group_id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      const { error: deleteError } = await supabase
        .from("email_unsubscribe_groups")
        .delete()
        .eq("id", payload.groupId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: "Failed to delete unsubscribe group" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "sync") {
      const sgResponse = await fetch("https://api.sendgrid.com/v3/asm/groups", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!sgResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch unsubscribe groups from SendGrid" }),
          { status: sgResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sgGroups = await sgResponse.json();

      const { data: existingGroups } = await supabase
        .from("email_unsubscribe_groups")
        .select("id")
        .eq("org_id", orgId);

      const hasExisting = existingGroups && existingGroups.length > 0;

      for (let i = 0; i < sgGroups.length; i++) {
        const sgGroup = sgGroups[i];
        await supabase
          .from("email_unsubscribe_groups")
          .upsert({
            org_id: orgId,
            sendgrid_group_id: String(sgGroup.id),
            name: sgGroup.name,
            description: sgGroup.description || null,
            is_default: !hasExisting && i === 0,
          }, { onConflict: "org_id,sendgrid_group_id" });
      }

      if (!hasExisting && sgGroups.length > 0) {
        const { data: firstGroup } = await supabase
          .from("email_unsubscribe_groups")
          .select("id")
          .eq("org_id", orgId)
          .eq("is_default", true)
          .single();

        if (firstGroup) {
          await supabase
            .from("email_defaults")
            .update({ default_unsubscribe_group_id: firstGroup.id })
            .eq("org_id", orgId);
        }
      }

      return new Response(
        JSON.stringify({ success: true, synced: sgGroups.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
