import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, slug, rating, comment } = await req.json();

    if (action === 'load') {
      const { data: reviewRequest, error: reqError } = await supabase
        .from('review_requests')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, phone)
        `)
        .eq('public_slug', slug)
        .maybeSingle();

      if (reqError) throw reqError;
      if (!reviewRequest) {
        return new Response(
          JSON.stringify({ error: 'Review request not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: settings, error: settingsError } = await supabase
        .from('reputation_settings')
        .select('*')
        .eq('organization_id', reviewRequest.organization_id)
        .maybeSingle();

      if (settingsError) throw settingsError;

      return new Response(
        JSON.stringify({ reviewRequest, settings }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'track_click') {
      const { data: request } = await supabase
        .from('review_requests')
        .select('id, organization_id, contact_id, clicked_at')
        .eq('public_slug', slug)
        .maybeSingle();

      if (!request || request.clicked_at) {
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('review_requests')
        .update({ clicked_at: new Date().toISOString() })
        .eq('public_slug', slug);

      await supabase.from('contact_timeline').insert({
        contact_id: request.contact_id,
        event_type: 'review_link_clicked',
        event_data: { request_id: request.id },
      });

      await supabase.from('event_outbox').insert({
        org_id: request.organization_id,
        event_type: 'review.clicked',
        contact_id: request.contact_id,
        entity_type: 'review_request',
        entity_id: request.id,
        payload: {
          contact_id: request.contact_id,
          request_id: request.id,
        },
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'submit') {
      const { data: reviewRequest, error: reqError } = await supabase
        .from('review_requests')
        .select('*')
        .eq('public_slug', slug)
        .maybeSingle();

      if (reqError) throw reqError;
      if (!reviewRequest) {
        return new Response(
          JSON.stringify({ error: 'Review request not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (reviewRequest.completed_at) {
        return new Response(
          JSON.stringify({ error: 'Review already submitted' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: settings } = await supabase
        .from('reputation_settings')
        .select('*')
        .eq('organization_id', reviewRequest.organization_id)
        .maybeSingle();

      const { data: contact } = await supabase
        .from('contacts')
        .select('first_name, last_name, email')
        .eq('id', reviewRequest.contact_id)
        .maybeSingle();

      const reviewerName = contact
        ? `${contact.first_name} ${contact.last_name}`.trim()
        : 'Anonymous';

      const isPositive = settings && rating >= settings.smart_threshold;

      const { data: review, error: reviewError } = await supabase
        .from('reviews')
        .insert({
          organization_id: reviewRequest.organization_id,
          provider: isPositive ? reviewRequest.provider_preference === 'google' ? 'google' : 'facebook' : 'internal',
          contact_id: reviewRequest.contact_id,
          review_request_id: reviewRequest.id,
          rating,
          comment: comment || null,
          reviewer_name: reviewerName,
          reviewer_email: contact?.email || null,
          published: isPositive,
          received_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (reviewError) throw reviewError;

      await supabase
        .from('review_requests')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', reviewRequest.id);

      await supabase.from('contact_timeline').insert({
        contact_id: reviewRequest.contact_id,
        event_type: isPositive ? 'review_submitted' : 'negative_feedback_received',
        event_data: {
          review_id: review.id,
          rating,
          provider: review.provider,
        },
      });

      const eventType = isPositive ? 'review.submitted' : 'review.negative_received';
      await supabase.from('event_outbox').insert({
        org_id: reviewRequest.organization_id,
        event_type: eventType,
        contact_id: reviewRequest.contact_id,
        entity_type: 'review',
        entity_id: review.id,
        payload: {
          review_id: review.id,
          rating,
          provider: review.provider,
          contact_id: reviewRequest.contact_id,
        },
      });

      let redirectUrl = null;
      if (isPositive && settings) {
        if (reviewRequest.provider_preference === 'google' && settings.google_review_url) {
          redirectUrl = settings.google_review_url;
        } else if (reviewRequest.provider_preference === 'facebook' && settings.facebook_review_url) {
          redirectUrl = settings.facebook_review_url;
        } else if (settings.google_review_url) {
          redirectUrl = settings.google_review_url;
        }
      }

      return new Response(
        JSON.stringify({ success: true, redirectUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
