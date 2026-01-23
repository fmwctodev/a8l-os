/*
  # Seed Reputation Module Sample Data

  1. Sample Data
    - Create internal review provider
    - Create default reputation settings
    - Create sample reviews (mix of ratings and providers)
    - Create sample review requests
    - Link reviews to existing contacts

  2. Notes
    - Uses existing organization and contacts
    - Creates realistic review distribution
    - Sets up initial state for testing
*/

DO $$
DECLARE
  v_org_id uuid;
  v_contact1_id uuid;
  v_contact2_id uuid;
  v_contact3_id uuid;
  v_user_id uuid;
  v_internal_provider_id uuid;
  v_request1_id uuid;
  v_request2_id uuid;
BEGIN
  -- Get first organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  -- Get first user
  SELECT id INTO v_user_id FROM users WHERE organization_id = v_org_id LIMIT 1;
  
  -- Get some contacts
  SELECT id INTO v_contact1_id FROM contacts WHERE organization_id = v_org_id AND status = 'active' ORDER BY created_at LIMIT 1 OFFSET 0;
  SELECT id INTO v_contact2_id FROM contacts WHERE organization_id = v_org_id AND status = 'active' ORDER BY created_at LIMIT 1 OFFSET 1;
  SELECT id INTO v_contact3_id FROM contacts WHERE organization_id = v_org_id AND status = 'active' ORDER BY created_at LIMIT 1 OFFSET 2;

  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE NOTICE 'No organization or user found, skipping reputation seed data';
    RETURN;
  END IF;

  -- Create internal review provider
  INSERT INTO review_providers (
    organization_id,
    provider,
    display_name,
    status,
    redirect_threshold
  ) VALUES (
    v_org_id,
    'internal',
    'Internal Feedback',
    'connected',
    4
  )
  ON CONFLICT (organization_id, provider) DO NOTHING;

  -- Create Google review provider stub
  INSERT INTO review_providers (
    organization_id,
    provider,
    external_location_id,
    display_name,
    status,
    redirect_threshold
  ) VALUES (
    v_org_id,
    'google',
    'placeholder_location_id',
    'Google Business',
    'disconnected',
    4
  )
  ON CONFLICT (organization_id, provider) DO NOTHING;

  -- Create default reputation settings
  INSERT INTO reputation_settings (
    organization_id,
    smart_threshold,
    default_channel,
    default_sms_template,
    default_email_template,
    default_email_subject,
    brand_name,
    brand_primary_color
  ) VALUES (
    v_org_id,
    4,
    'sms',
    'Hi {first_name}, how was your experience with {company_name}? Please share your feedback: {review_link}',
    E'Hi {first_name},\n\nThank you for choosing {company_name}. We''d love to hear about your experience.\n\nPlease take a moment to share your feedback:\n{review_link}\n\nThank you!',
    'How was your experience with {company_name}?',
    'Autom8ion CRM',
    '#3B82F6'
  )
  ON CONFLICT (organization_id) DO NOTHING;

  -- Create sample reviews
  IF v_contact1_id IS NOT NULL THEN
    -- 5-star Google review
    INSERT INTO reviews (
      organization_id,
      provider,
      provider_review_id,
      contact_id,
      rating,
      comment,
      reviewer_name,
      reviewer_email,
      published,
      received_at
    ) VALUES (
      v_org_id,
      'google',
      'google_review_123',
      v_contact1_id,
      5,
      'Excellent service! Very professional and responsive. Highly recommend.',
      'John Smith',
      'john@example.com',
      true,
      now() - interval '5 days'
    );

    -- Add timeline event
    INSERT INTO contact_timeline (
      contact_id,
      event_type,
      event_data
    ) VALUES (
      v_contact1_id,
      'review_submitted',
      jsonb_build_object('rating', 5, 'provider', 'google')
    );
  END IF;

  IF v_contact2_id IS NOT NULL THEN
    -- 4-star Facebook review
    INSERT INTO reviews (
      organization_id,
      provider,
      provider_review_id,
      contact_id,
      rating,
      comment,
      reviewer_name,
      reviewer_email,
      published,
      received_at
    ) VALUES (
      v_org_id,
      'facebook',
      'facebook_review_456',
      v_contact2_id,
      4,
      'Great experience overall. Quick response time and helpful staff.',
      'Jane Doe',
      'jane@example.com',
      true,
      now() - interval '3 days'
    );

    -- Add timeline event
    INSERT INTO contact_timeline (
      contact_id,
      event_type,
      event_data
    ) VALUES (
      v_contact2_id,
      'review_submitted',
      jsonb_build_object('rating', 4, 'provider', 'facebook')
    );
  END IF;

  IF v_contact3_id IS NOT NULL THEN
    -- 2-star internal feedback
    INSERT INTO reviews (
      organization_id,
      provider,
      contact_id,
      rating,
      comment,
      reviewer_name,
      reviewer_email,
      published,
      received_at
    ) VALUES (
      v_org_id,
      'internal',
      v_contact3_id,
      2,
      'Service was okay but could be better. Response time was slow.',
      'Bob Johnson',
      'bob@example.com',
      false,
      now() - interval '1 day'
    );

    -- Add timeline event
    INSERT INTO contact_timeline (
      contact_id,
      event_type,
      event_data
    ) VALUES (
      v_contact3_id,
      'negative_feedback_received',
      jsonb_build_object('rating', 2, 'provider', 'internal')
    );
  END IF;

  -- Create sample review requests
  IF v_contact1_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    -- Completed review request
    INSERT INTO review_requests (
      organization_id,
      contact_id,
      public_slug,
      provider_preference,
      channel,
      message_template,
      review_link_url,
      sent_at,
      clicked_at,
      completed_at,
      created_by
    ) VALUES (
      v_org_id,
      v_contact1_id,
      'sample123abc',
      'smart',
      'sms',
      'Hi John, how was your experience with us? Please share your feedback: https://example.com/r/sample123abc',
      'https://example.com/r/sample123abc',
      now() - interval '6 days',
      now() - interval '5 days 23 hours',
      now() - interval '5 days',
      v_user_id
    );
  END IF;

  IF v_contact2_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    -- Sent but not completed
    INSERT INTO review_requests (
      organization_id,
      contact_id,
      public_slug,
      provider_preference,
      channel,
      message_template,
      review_link_url,
      sent_at,
      created_by
    ) VALUES (
      v_org_id,
      v_contact2_id,
      'sample456def',
      'smart',
      'email',
      'Hi Jane, we would love to hear about your experience. Please click here to share your feedback: https://example.com/r/sample456def',
      'https://example.com/r/sample456def',
      now() - interval '2 days',
      v_user_id
    );
  END IF;

  RAISE NOTICE 'Reputation sample data seeded successfully';
END $$;
