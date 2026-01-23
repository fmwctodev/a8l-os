import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ENCRYPTION_KEY = Deno.env.get("PHONE_ENCRYPTION_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32);

async function decrypt(encryptedText: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  const key = await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["decrypt"]);
  const combined = Uint8Array.from(atob(encryptedText), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

async function getTwilioCredentials(supabase: any, orgId: string) {
  const { data: connection } = await supabase
    .from("twilio_connection")
    .select("account_sid, auth_token_encrypted, status")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    throw new Error("Twilio not connected");
  }

  const authToken = await decrypt(connection.auth_token_encrypted);
  return { accountSid: connection.account_sid, authToken };
}

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
      case "sync": {
        const { accountSid, authToken } = await getTwilioCredentials(supabase, orgId);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messaging/Services.json`,
          {
            headers: {
              Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
            },
          }
        );

        if (!response.ok) {
          return new Response(JSON.stringify({ error: "Failed to fetch messaging services from Twilio" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const twilioData = await response.json();
        const services = twilioData.services || [];

        const results = [];
        for (const svc of services) {
          const { data, error } = await supabase
            .from("twilio_messaging_services")
            .upsert({
              org_id: orgId,
              service_sid: svc.sid,
              name: svc.friendly_name,
              description: svc.inbound_request_url || null,
              status: "active",
            }, { onConflict: "org_id,service_sid" })
            .select()
            .single();

          if (!error && data) {
            results.push(data);
          }
        }

        return new Response(JSON.stringify({ success: true, services: results, count: results.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create": {
        const { name, description } = payload;
        const { accountSid, authToken } = await getTwilioCredentials(supabase, orgId);

        if (!name) {
          return new Response(JSON.stringify({ error: "Name is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messaging/Services.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              FriendlyName: name,
              ...(description && { InboundRequestUrl: description }),
            }).toString(),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          return new Response(JSON.stringify({ error: errorData.message || "Failed to create messaging service" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const twilioService = await response.json();

        const { data, error } = await supabase
          .from("twilio_messaging_services")
          .insert({
            org_id: orgId,
            service_sid: twilioService.sid,
            name: twilioService.friendly_name,
            description: description || null,
            status: "active",
          })
          .select()
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, service: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "link": {
        const { serviceSid, name } = payload;
        const { accountSid, authToken } = await getTwilioCredentials(supabase, orgId);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messaging/Services/${serviceSid}.json`,
          {
            headers: {
              Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
            },
          }
        );

        if (!response.ok) {
          return new Response(JSON.stringify({ error: "Messaging service not found in Twilio" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const twilioService = await response.json();

        const { data, error } = await supabase
          .from("twilio_messaging_services")
          .upsert({
            org_id: orgId,
            service_sid: serviceSid,
            name: name || twilioService.friendly_name,
            status: "active",
          }, { onConflict: "org_id,service_sid" })
          .select()
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, service: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list": {
        const { data: services, error } = await supabase
          .from("twilio_messaging_services")
          .select("*")
          .eq("org_id", orgId)
          .order("name");

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        for (const svc of services) {
          const { count } = await supabase
            .from("messaging_service_senders")
            .select("*", { count: "exact", head: true })
            .eq("service_id", svc.id);
          svc.sender_count = count || 0;
        }

        return new Response(JSON.stringify({ services }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "set-default": {
        const { serviceId } = payload;

        await supabase
          .from("twilio_messaging_services")
          .update({ is_default: false })
          .eq("org_id", orgId);

        const { error } = await supabase
          .from("twilio_messaging_services")
          .update({ is_default: true })
          .eq("id", serviceId)
          .eq("org_id", orgId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase
          .from("phone_settings")
          .update({ default_messaging_service_id: serviceId })
          .eq("org_id", orgId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "add-sender": {
        const { serviceId, numberId } = payload;
        const { accountSid, authToken } = await getTwilioCredentials(supabase, orgId);

        const { data: service } = await supabase
          .from("twilio_messaging_services")
          .select("service_sid")
          .eq("id", serviceId)
          .eq("org_id", orgId)
          .maybeSingle();

        const { data: number } = await supabase
          .from("twilio_numbers")
          .select("phone_sid")
          .eq("id", numberId)
          .eq("org_id", orgId)
          .maybeSingle();

        if (!service || !number) {
          return new Response(JSON.stringify({ error: "Service or number not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messaging/Services/${service.service_sid}/PhoneNumbers.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ PhoneNumberSid: number.phone_sid }).toString(),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          return new Response(JSON.stringify({ error: errorData.message || "Failed to add sender to service" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabase
          .from("messaging_service_senders")
          .insert({
            org_id: orgId,
            service_id: serviceId,
            number_id: numberId,
          });

        if (error && !error.message.includes("duplicate")) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "remove-sender": {
        const { serviceId, numberId } = payload;
        const { accountSid, authToken } = await getTwilioCredentials(supabase, orgId);

        const { data: service } = await supabase
          .from("twilio_messaging_services")
          .select("service_sid")
          .eq("id", serviceId)
          .eq("org_id", orgId)
          .maybeSingle();

        const { data: number } = await supabase
          .from("twilio_numbers")
          .select("phone_sid")
          .eq("id", numberId)
          .eq("org_id", orgId)
          .maybeSingle();

        if (!service || !number) {
          return new Response(JSON.stringify({ error: "Service or number not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messaging/Services/${service.service_sid}/PhoneNumbers/${number.phone_sid}.json`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
            },
          }
        );

        await supabase
          .from("messaging_service_senders")
          .delete()
          .eq("service_id", serviceId)
          .eq("number_id", numberId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-senders": {
        const { serviceId } = payload;

        const { data: senders, error } = await supabase
          .from("messaging_service_senders")
          .select("*, number:twilio_numbers(*)")
          .eq("service_id", serviceId)
          .eq("org_id", orgId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ senders }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { serviceId } = payload;
        const { accountSid, authToken } = await getTwilioCredentials(supabase, orgId);

        const { data: service } = await supabase
          .from("twilio_messaging_services")
          .select("service_sid")
          .eq("id", serviceId)
          .eq("org_id", orgId)
          .maybeSingle();

        if (!service) {
          return new Response(JSON.stringify({ error: "Service not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messaging/Services/${service.service_sid}.json`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
            },
          }
        );

        await supabase
          .from("messaging_service_senders")
          .delete()
          .eq("service_id", serviceId);

        await supabase
          .from("twilio_messaging_services")
          .delete()
          .eq("id", serviceId)
          .eq("org_id", orgId);

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
