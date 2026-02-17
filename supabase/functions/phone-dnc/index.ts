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
        const { page = 1, limit = 50, search } = payload;
        const offset = (page - 1) * limit;

        let query = supabase
          .from("dnc_numbers")
          .select("*, added_by_user:users!dnc_numbers_added_by_fkey(id, name, email)", { count: "exact" })
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (search) {
          query = query.ilike("phone_number", `%${search}%`);
        }

        const { data: dncNumbers, count, error } = await query;

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let contactQuery = supabase
          .from("contacts")
          .select("id, phone, first_name, last_name", { count: "exact" })
          .eq("organization_id", orgId)
          .eq("dnc", true)
          .not("phone", "is", null)
          .order("updated_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (search) {
          contactQuery = contactQuery.ilike("phone", `%${search}%`);
        }

        const { data: dncContacts, count: contactCount } = await contactQuery;

        const combined = [
          ...(dncNumbers || []).map((d: any) => ({
            id: d.id,
            phoneNumber: d.phone_number,
            reason: d.reason,
            source: "manual" as const,
            addedBy: d.added_by_user?.name || d.added_by_user?.email,
            createdAt: d.created_at,
          })),
          ...(dncContacts || []).map((c: any) => ({
            id: c.id,
            phoneNumber: c.phone,
            reason: "Contact marked as DNC",
            source: "contact" as const,
            contactName: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
            createdAt: null,
          })),
        ];

        return new Response(JSON.stringify({
          numbers: combined,
          total: (count || 0) + (contactCount || 0),
          page,
          limit,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "add": {
        const { phoneNumber, reason } = payload;

        if (!phoneNumber) {
          return new Response(JSON.stringify({ error: "Phone number is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const normalizedPhone = phoneNumber.replace(/[^\d+]/g, "");

        const { data, error } = await supabase
          .from("dnc_numbers")
          .insert({
            org_id: orgId,
            phone_number: normalizedPhone,
            reason: reason || null,
            added_by: user.id,
          })
          .select()
          .single();

        if (error) {
          if (error.message.includes("duplicate")) {
            return new Response(JSON.stringify({ error: "Phone number already in DNC list" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, dncNumber: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "remove": {
        const { id, source } = payload;

        if (source === "contact") {
          const { error } = await supabase
            .from("contacts")
            .update({ dnc: false })
            .eq("id", id)
            .eq("organization_id", orgId);

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          const { error } = await supabase
            .from("dnc_numbers")
            .delete()
            .eq("id", id)
            .eq("org_id", orgId);

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "import": {
        const { numbers } = payload;

        if (!Array.isArray(numbers) || numbers.length === 0) {
          return new Response(JSON.stringify({ error: "Numbers array is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const toInsert = numbers.map((n: any) => ({
          org_id: orgId,
          phone_number: (n.phoneNumber || n).toString().replace(/[^\d+]/g, ""),
          reason: n.reason || "Bulk import",
          added_by: user.id,
        }));

        const { data, error } = await supabase
          .from("dnc_numbers")
          .upsert(toInsert, { onConflict: "org_id,phone_number", ignoreDuplicates: true })
          .select();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, imported: data?.length || 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check": {
        const { phoneNumber } = payload;

        if (!phoneNumber) {
          return new Response(JSON.stringify({ error: "Phone number is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const normalizedPhone = phoneNumber.replace(/[^\d+]/g, "");

        const { data: dncEntry } = await supabase
          .from("dnc_numbers")
          .select("id")
          .eq("org_id", orgId)
          .eq("phone_number", normalizedPhone)
          .maybeSingle();

        const { data: dncContact } = await supabase
          .from("contacts")
          .select("id")
          .eq("organization_id", orgId)
          .eq("phone", normalizedPhone)
          .eq("dnc", true)
          .maybeSingle();

        const isBlocked = !!dncEntry || !!dncContact;

        return new Response(JSON.stringify({
          isBlocked,
          source: dncEntry ? "manual" : dncContact ? "contact" : null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "export": {
        const { data: dncNumbers } = await supabase
          .from("dnc_numbers")
          .select("phone_number, reason, created_at")
          .eq("org_id", orgId)
          .order("phone_number");

        const { data: dncContacts } = await supabase
          .from("contacts")
          .select("phone, first_name, last_name")
          .eq("organization_id", orgId)
          .eq("dnc", true)
          .not("phone", "is", null);

        const csvRows = [
          "Phone Number,Reason,Source,Date Added",
          ...(dncNumbers || []).map((d: any) =>
            `"${d.phone_number}","${d.reason || ""}","Manual","${d.created_at || ""}"`
          ),
          ...(dncContacts || []).map((c: any) =>
            `"${c.phone}","Contact marked as DNC","Contact",""`
          ),
        ];

        return new Response(csvRows.join("\n"), {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/csv",
            "Content-Disposition": "attachment; filename=dnc-list.csv",
          },
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
