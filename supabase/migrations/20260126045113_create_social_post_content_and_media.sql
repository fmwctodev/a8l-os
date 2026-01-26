/*
  # Create Social Post Content and Media Tables for Per-Channel Customization

  1. New Tables
    - `social_post_content`
      - Stores per-platform customized text content
      - Links to social_posts via post_id
      - Stores platform-specific text and follow-up comment
    
    - `social_post_media`
      - Stores per-platform customized media attachments
      - Links to social_posts via post_id
      - Stores media items as JSONB array

  2. Security
    - Enable RLS on both tables
    - Policies based on post ownership within organization

  3. Indexes
    - post_id and platform for efficient lookups
*/

CREATE TABLE IF NOT EXISTS social_post_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  platform text NOT NULL,
  account_id uuid REFERENCES social_accounts(id) ON DELETE SET NULL,
  text text NOT NULL DEFAULT '',
  follow_up_comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(post_id, platform, account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_post_content_post_id ON social_post_content(post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_content_platform ON social_post_content(platform);

CREATE TABLE IF NOT EXISTS social_post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  platform text NOT NULL,
  account_id uuid REFERENCES social_accounts(id) ON DELETE SET NULL,
  media_items jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, platform, account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_post_media_post_id ON social_post_media(post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_media_platform ON social_post_media(platform);

ALTER TABLE social_post_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_post_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view post content in their organization"
  ON social_post_content
  FOR SELECT
  TO authenticated
  USING (
    post_id IN (
      SELECT id FROM social_posts 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create post content in their organization"
  ON social_post_content
  FOR INSERT
  TO authenticated
  WITH CHECK (
    post_id IN (
      SELECT id FROM social_posts 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update post content in their organization"
  ON social_post_content
  FOR UPDATE
  TO authenticated
  USING (
    post_id IN (
      SELECT id FROM social_posts 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    post_id IN (
      SELECT id FROM social_posts 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete post content in their organization"
  ON social_post_content
  FOR DELETE
  TO authenticated
  USING (
    post_id IN (
      SELECT id FROM social_posts 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can view post media in their organization"
  ON social_post_media
  FOR SELECT
  TO authenticated
  USING (
    post_id IN (
      SELECT id FROM social_posts 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create post media in their organization"
  ON social_post_media
  FOR INSERT
  TO authenticated
  WITH CHECK (
    post_id IN (
      SELECT id FROM social_posts 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update post media in their organization"
  ON social_post_media
  FOR UPDATE
  TO authenticated
  USING (
    post_id IN (
      SELECT id FROM social_posts 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    post_id IN (
      SELECT id FROM social_posts 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete post media in their organization"
  ON social_post_media
  FOR DELETE
  TO authenticated
  USING (
    post_id IN (
      SELECT id FROM social_posts 
      WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION update_social_post_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_social_post_content_updated_at
  BEFORE UPDATE ON social_post_content
  FOR EACH ROW
  EXECUTE FUNCTION update_social_post_content_updated_at();
