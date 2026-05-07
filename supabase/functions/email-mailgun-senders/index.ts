import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Mailgun has no remote "verified senders" concept — domain authentication
 * implicitly authorizes any from-address on that domain. This function therefore
 * manages the local email_from_addresses catalog and validates that addresses
 * match a configured (verified) Mailgun domain.
 *
 * Action shapes mirror email-sendgrid-senders for compatibility with existing
 * frontend code.
 */

interface CreateRequest {
  action: "create";
  displayName: string;
  email: string;
  replyTo?: string;
  domainId: string;
}

interface UpdateRequest {
  action: "update";
  addressId: string;
  displayName?: string;
  replyTo?: string;
  active?: boolean;
}

interface SetDefaultRequest {
  action: "set-default";
  addressId: string;
}

interface DeleteRequest {
  action: "delete";
  addressId: string;
}

interface SyncRequest {
  action: "sync";
}

type RequestPayload = CreateRequest | UpdateRequest | SetDefaultRequest | DeleteRequest | SyncRequest;

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

    if (payload.action === "create") {
      const { data: domain } = await supabase
        .from("email_domains")
        .select("domain, status")
        .eq("id", payload.domainId)
        .eq("org_id", orgId)
        .single();

      if (!domain) {
        return new Response(
          JSON.stringify({ error: "Domain not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const emailDomain = payload.email.split("@")[1];
      if (emailDomain !== domain.domain) {
        return new Response(
          JSON.stringify({ error: "Email domain does not match selected domain" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (domain.status !== "verified") {
        return new Response(
          JSON.stringify({ error: "Cannot add a sender on an unverified domain" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: existingAddresses } = await supabase
        .from("email_from_addresses")
        .select("id")
        .eq("org_id", orgId);

      const isFirst = !existingAddresses || existingAddresses.length === 0;

      const { data: address, error: insertError } = await supabase
        .from("email_from_addresses")
        .insert({
          org_id: orgId,
          display_name: payload.displayName,
          email: payload.email,
          domain_id: payload.domainId,
          reply_to: payload.replyTo || null,
          provider_sender_id: payload.email, // Mailgun has no separate sender ID; use the email itself
          is_default: isFirst,
          active: true,
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Failed to save from address" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (isFirst) {
        await supabase
          .from("email_defaults")
          .upsert({ org_id: orgId, default_from_address_id: address.id }, { onConflict: "org_id" });
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.from_address.created",
        entity_type: "email_from_address",
        entity_id: address.id,
        details: { email: payload.email, display_name: payload.displayName, provider: "mailgun" },
      });

      return new Response(
        JSON.stringify({ success: true, address }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "update") {
      const { data: address } = await supabase
        .from("email_from_addresses")
        .select("id, email")
        .eq("id", payload.addressId)
        .eq("org_id", orgId)
        .single();

      if (!address) {
        return new Response(
          JSON.stringify({ error: "From address not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const updates: Record<string, unknown> = {};
      if (payload.displayName !== undefined) updates.display_name = payload.displayName;
      if (payload.replyTo !== undefined) updates.reply_to = payload.replyTo || null;
      if (payload.active !== undefined) updates.active = payload.active;

      const { error: updateError } = await supabase
        .from("email_from_addresses")
        .update(updates)
        .eq("id", payload.addressId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to update from address" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.from_address.updated",
        entity_type: "email_from_address",
        entity_id: payload.addressId,
        details: { email: address.email, changes: updates },
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "set-default") {
      const { data: address } = await supabase
        .from("email_from_addresses")
        .select("id, email")
        .eq("id", payload.addressId)
        .eq("org_id", orgId)
        .single();

      if (!address) {
        return new Response(
          JSON.stringify({ error: "From address not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase
        .from("email_from_addresses")
        .update({ is_default: false })
        .eq("org_id", orgId);

      await supabase
        .from("email_from_addresses")
        .update({ is_default: true })
        .eq("id", payload.addressId);

      await supabase
        .from("email_defaults")
        .upsert({ org_id: orgId, default_from_address_id: payload.addressId }, { onConflict: "org_id" });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "delete") {
      const { data: address } = await supabase
        .from("email_from_addresses")
        .select("id, email, is_default")
        .eq("id", payload.addressId)
        .eq("org_id", orgId)
        .single();

      if (!address) {
        return new Response(
          JSON.stringify({ error: "From address not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (address.is_default) {
        return new Response(
          JSON.stringify({ error: "Cannot delete default from address" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: deleteError } = await supabase
        .from("email_from_addresses")
        .delete()
        .eq("id", payload.addressId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: "Failed to delete from address" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        user_id: user.id,
        action: "email.from_address.deleted",
        entity_type: "email_from_address",
        entity_id: payload.addressId,
        details: { email: address.email },
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.action === "sync") {
      // Mailgun has no remote sender list. Sync is a no-op that just confirms
      // the local catalog is consistent (e.g. flips is_default if all flags
      // were cleared).
      const { data: addresses } = await supabase
        .from("email_from_addresses")
        .select("id, is_default")
        .eq("org_id", orgId)
        .eq("active", true);

      if (addresses && addresses.length > 0 && !addresses.some((a: { is_default: boolean }) => a.is_default)) {
        await supabase
          .from("email_from_addresses")
          .update({ is_default: true })
          .eq("id", addresses[0].id);
      }

      return new Response(
        JSON.stringify({ success: true, synced: addresses?.length ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
