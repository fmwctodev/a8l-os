/*
  # Create Brand Usage Tracking and Storage Bucket

  1. New Tables
    - `brand_usage`
      - `id` (uuid, primary key)
      - `org_id` (uuid, foreign key to organizations)
      - `brand_type` (text, 'kit' or 'voice')
      - `brand_id` (uuid, reference to brand_kit or brand_voice)
      - `entity_type` (text, type of entity using the brand)
      - `entity_id` (uuid, id of the entity)
      - `entity_name` (text, cached name for display)
      - `last_used_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Storage Bucket
    - `brand-assets` bucket for uploaded logos and imagery
    - Configured with org-scoped access policies

  3. Indexes
    - Index on org_id and brand_type for filtered queries
    - Index on brand_id for usage lookups
    - Index on entity_type for filtering by entity
*/

-- Create brand_usage table for tracking where brand assets are used
CREATE TABLE IF NOT EXISTS brand_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_type text NOT NULL CHECK (brand_type IN ('kit', 'voice')),
  brand_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  entity_name text,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, brand_type, brand_id, entity_type, entity_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_brand_usage_org_type ON brand_usage(org_id, brand_type);
CREATE INDEX IF NOT EXISTS idx_brand_usage_brand_id ON brand_usage(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_usage_entity_type ON brand_usage(org_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_brand_usage_last_used ON brand_usage(org_id, last_used_at DESC);

-- Add comments for documentation
COMMENT ON TABLE brand_usage IS 'Tracks where brand kits and voices are used across the application';
COMMENT ON COLUMN brand_usage.brand_type IS 'Type of brand asset: kit or voice';
COMMENT ON COLUMN brand_usage.entity_type IS 'Type of entity using the brand: ai_agent, email_template, proposal, invoice, document, social_post';
COMMENT ON COLUMN brand_usage.entity_name IS 'Cached name of the entity for display purposes';

-- Create storage bucket for brand assets (logos, imagery)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  false,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for brand-assets bucket
-- Policy: Users can view brand assets from their organization
CREATE POLICY "Users can view org brand assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'brand-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM users WHERE id = auth.uid()
  )
);

-- Policy: Users with brandboard.manage can upload brand assets
CREATE POLICY "Users can upload org brand assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'brand-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM users WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = auth.uid()
    AND p.key = 'brandboard.manage'
  )
);

-- Policy: Users with brandboard.manage can update brand assets
CREATE POLICY "Users can update org brand assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'brand-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM users WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = auth.uid()
    AND p.key = 'brandboard.manage'
  )
);

-- Policy: Users with brandboard.manage can delete brand assets
CREATE POLICY "Users can delete org brand assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'brand-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM users WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = auth.uid()
    AND p.key = 'brandboard.manage'
  )
);
