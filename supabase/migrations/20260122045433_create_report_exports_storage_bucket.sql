/*
  # Create Report Exports Storage Bucket

  Creates a storage bucket for CSV report exports with 14-day retention policy.

  1. Storage Bucket
    - Name: report-exports
    - Public: false (requires signed URLs)
    
  2. Policies
    - Authenticated users can upload to their org folder
    - Authenticated users can read from their org folder
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-exports',
  'report-exports',
  false,
  52428800,
  ARRAY['text/csv', 'application/csv']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload report exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'report-exports'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can read their org report exports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'report-exports'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can delete their org report exports"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'report-exports'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM users WHERE id = auth.uid()
  )
);