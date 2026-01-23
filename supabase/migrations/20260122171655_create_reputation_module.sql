/*
  # Create Reputation Management Module

  1. New Tables
    - `review_providers`
      - Manages connections to external review platforms (Google, Facebook) and internal reviews
      - Stores API credentials (encrypted) and connection status
      - Includes redirect threshold for smart routing
    
    - `review_requests`
      - Tracks outbound review solicitations sent to contacts
      - Unique public_slug for the smart review page
      - Tracks lifecycle: sent_at, clicked_at, completed_at
      - Links to contact and channel used
    
    - `reviews`
      - Stores all reviews (external and internal)
      - Links to contact, provider, and originating request
      - Supports both positive reviews and negative internal feedback
    
    - `reputation_settings`
      - Organization-wide configuration
      - Smart threshold for routing (default 4 stars)
      - Default templates and branding settings

  2. Security
    - Enable RLS on all tables
    - Policies will be added in next migration

  3. Important Notes
    - All tables are organization-scoped
    - Public slug enables branded review page access
    - Smart routing based on rating threshold
*/

-- Review providers table
CREATE TABLE IF NOT EXISTS review_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'facebook', 'internal')),
  external_location_id text,
  display_name text NOT NULL,
  api_credentials jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  redirect_threshold integer DEFAULT 4 CHECK (redirect_threshold >= 1 AND redirect_threshold <= 5),
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_review_providers_org ON review_providers(organization_id);
CREATE INDEX IF NOT EXISTS idx_review_providers_status ON review_providers(status);

-- Review requests table
CREATE TABLE IF NOT EXISTS review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  public_slug text NOT NULL UNIQUE,
  provider_preference text NOT NULL DEFAULT 'smart' CHECK (provider_preference IN ('smart', 'google', 'facebook', 'internal')),
  channel text NOT NULL CHECK (channel IN ('sms', 'email')),
  message_template text NOT NULL,
  review_link_url text NOT NULL,
  sent_at timestamptz,
  clicked_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_requests_org ON review_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_contact ON review_requests(contact_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_slug ON review_requests(public_slug);
CREATE INDEX IF NOT EXISTS idx_review_requests_sent ON review_requests(sent_at);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'facebook', 'internal')),
  provider_review_id text,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  review_request_id uuid REFERENCES review_requests(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  reviewer_name text NOT NULL,
  reviewer_email text,
  published boolean DEFAULT true,
  received_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_org ON reviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_reviews_contact ON reviews(contact_id);
CREATE INDEX IF NOT EXISTS idx_reviews_request ON reviews(review_request_id);
CREATE INDEX IF NOT EXISTS idx_reviews_provider_received ON reviews(provider, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- Reputation settings table (one per organization)
CREATE TABLE IF NOT EXISTS reputation_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  smart_threshold integer DEFAULT 4 CHECK (smart_threshold >= 1 AND smart_threshold <= 5),
  default_channel text DEFAULT 'sms' CHECK (default_channel IN ('sms', 'email')),
  default_sms_template text DEFAULT 'Hi {first_name}, how was your experience with {company_name}? Please share your feedback: {review_link}',
  default_email_template text DEFAULT 'Hi {first_name},\n\nThank you for choosing {company_name}. We''d love to hear about your experience.\n\nPlease take a moment to share your feedback:\n{review_link}\n\nThank you!',
  default_email_subject text DEFAULT 'How was your experience with {company_name}?',
  google_review_url text,
  facebook_review_url text,
  brand_name text,
  brand_logo_url text,
  brand_primary_color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE review_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_settings ENABLE ROW LEVEL SECURITY;
