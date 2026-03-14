/*
  # Create team-attachments storage bucket

  1. New Storage Bucket
    - `team-attachments` - Private bucket for team messaging file attachments
    - Max file size: 100MB
    - Allowed MIME types: images, videos, audio, documents, PDFs, archives

  2. Security (RLS Policies)
    - Authenticated users can upload files scoped to their organization folder
    - Authenticated users can read files within their organization folder
    - Authenticated users can delete files within their organization folder
    - All policies enforce organization-level isolation via the users table
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team-attachments',
  'team-attachments',
  false,
  104857600,
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp','image/svg+xml','image/bmp',
    'video/mp4','video/webm','video/quicktime',
    'audio/mpeg','audio/ogg','audio/wav','audio/webm',
    'application/pdf',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain','text/csv',
    'application/zip','application/x-rar-compressed','application/gzip'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members can upload team attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'team-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can read team attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'team-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete team attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'team-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.users WHERE id = auth.uid()
    )
  );
