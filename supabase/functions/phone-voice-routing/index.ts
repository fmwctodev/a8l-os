import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!userData?.organization_id) {
      return new Response(JSON.stringify({ error: "User not associated with organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = userData.organization_id;
    const { action, ...payload } = await req.json();

    switch (action) {
      case "list": {
        const { data: groups, error } = await supabase
          .from("voice_routing_groups")
          .select(`
            *,
            destinations:voice_routing_destinations(*)
          `)
          .eq("org_id", orgId)
          .order("name");

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        for (const group of groups) {
          group.destinations = group.destinations?.sort((a: any, b: any) => a.sort_order - b.sort_order) || [];
        }

        return new Response(JSON.stringify({ groups }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create": {
        const { name, strategy, ringTimeout, fallbackNumber } = payload;

        if (!name) {
          return new Response(JSON.stringify({ error: "Name is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabase
          .from("voice_routing_groups")
          .insert({
            org_id: orgId,
            name,
            strategy: strategy || "simultaneous",
            ring_timeout: ringTimeout || 30,
            fallback_number: fallbackNumber || null,
          })
          .select()
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, group: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        const { groupId, name, strategy, ringTimeout, fallbackNumber, enabled } = payload;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (strategy !== undefined) updateData.strategy = strategy;
        if (ringTimeout !== undefined) updateData.ring_timeout = ringTimeout;
        if (fallbackNumber !== undefined) updateData.fallback_number = fallbackNumber;
        if (enabled !== undefined) updateData.enabled = enabled;

        const { data, error } = await supabase
          .from("voice_routing_groups")
          .update(updateData)
          .eq("id", groupId)
          .eq("org_id", orgId)
          .select()
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, group: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { groupId } = payload;

        await supabase
          .from("voice_routing_destinations")
          .delete()
          .eq("group_id", groupId);

        const { error } = await supabase
          .from("voice_routing_groups")
          .delete()
          .eq("id", groupId)
          .eq("org_id", orgId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "set-default": {
        const { groupId } = payload;

        await supabase
          .from("voice_routing_groups")
          .update({ is_default: false })
          .eq("org_id", orgId);

        const { error } = await supabase
          .from("voice_routing_groups")
          .update({ is_default: true })
          .eq("id", groupId)
          .eq("org_id", orgId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase
          .from("phone_settings")
          .update({ default_routing_group_id: groupId })
          .eq("org_id", orgId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "add-destination": {
        const { groupId, phoneNumber, label } = payload;

        if (!phoneNumber) {
          return new Response(JSON.stringify({ error: "Phone number is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: existing } = await supabase
          .from("voice_routing_destinations")
          .select("sort_order")
          .eq("group_id", groupId)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextOrder = (existing?.sort_order ?? -1) + 1;

        const { data, error } = await supabase
          .from("voice_routing_destinations")
          .insert({
            org_id: orgId,
            group_id: groupId,
            phone_number: phoneNumber,
            label: label || null,
            sort_order: nextOrder,
          })
          .select()
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, destination: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update-destination": {
        const { destinationId, phoneNumber, label, sortOrder, enabled } = payload;

        const updateData: any = {};
        if (phoneNumber !== undefined) updateData.phone_number = phoneNumber;
        if (label !== undefined) updateData.label = label;
        if (sortOrder !== undefined) updateData.sort_order = sortOrder;
        if (enabled !== undefined) updateData.enabled = enabled;

        const { data, error } = await supabase
          .from("voice_routing_destinations")
          .update(updateData)
          .eq("id", destinationId)
          .eq("org_id", orgId)
          .select()
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, destination: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "remove-destination": {
        const { destinationId } = payload;

        const { error } = await supabase
          .from("voice_routing_destinations")
          .delete()
          .eq("id", destinationId)
          .eq("org_id", orgId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reorder-destinations": {
        const { groupId, destinationIds } = payload;

        for (let i = 0; i < destinationIds.length; i++) {
          await supabase
            .from("voice_routing_destinations")
            .update({ sort_order: i })
            .eq("id", destinationIds[i])
            .eq("org_id", orgId);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
