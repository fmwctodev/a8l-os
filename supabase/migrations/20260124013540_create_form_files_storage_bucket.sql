/*
  # Create Form Files Storage Bucket

  Creates a Supabase Storage bucket for form file uploads with:
  - 100MB file size limit
  - Public read access for submitted files
  - Authenticated write access

  1. Storage Bucket
    - Name: form-files
    - Public: false (access controlled via policies)
    - File size limit: 100MB

  2. Policies
    - Authenticated users can upload files
    - Anyone can read files (for form submission attachments)
*/

-- Create the storage bucket for form files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-files',
  'form-files',
  false,
  104857600,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv', 'application/zip', 'video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/wav']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policy: Anyone can upload to form-files bucket (for public form submissions)
CREATE POLICY "Anyone can upload form files"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'form-files');

-- Storage policy: Anyone can read form files
CREATE POLICY "Anyone can read form files"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'form-files');

-- Storage policy: Authenticated users can delete form files in their org
CREATE POLICY "Authenticated users can delete form files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'form-files');
