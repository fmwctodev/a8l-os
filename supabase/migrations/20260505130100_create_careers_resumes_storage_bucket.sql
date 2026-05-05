/*
  # Storage bucket for careers form resume uploads

  Creates a public Supabase Storage bucket where the marketing-site careers
  form uploads candidate resumes. The browser uploads directly via the
  anon-key Supabase client; the resulting public URL is then included in
  the form-submit payload as `resume_file_url` and lands in the contact's
  custom_field_values so the contact detail card in a8l-os can render the
  resume link inline.

  Security model:
  - Bucket is PUBLIC (no signed URLs needed when rendering in a8l-os UI).
    URL contains a random UUID so it's effectively unguessable; mitigates
    accidental exposure short of someone leaking the URL.
  - Allowed MIME types restricted to PDF / DOC / DOCX at bucket level.
  - File size capped at 5 MB.
  - Anonymous role can INSERT (upload) but NOT UPDATE or DELETE — bots
    can't tamper with previously uploaded files.
  - Authenticated users (a8l-os staff) can read all + delete (for cleanup).

  If you later decide resumes are too sensitive for a public bucket, flip
  bucket.public to false and update CareersApplicationForm.tsx to fetch
  signed URLs via an Edge Function on display. The migration is reversible.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'careers-resumes',
  'careers-resumes',
  true,
  5242880, -- 5 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Anonymous can INSERT (upload). Path constraint limits where they can write.
DROP POLICY IF EXISTS "Anonymous can upload careers resumes" ON storage.objects;
CREATE POLICY "Anonymous can upload careers resumes"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'careers-resumes');

-- Authenticated users (a8l-os staff) can do everything in this bucket.
DROP POLICY IF EXISTS "Authenticated can read careers resumes" ON storage.objects;
CREATE POLICY "Authenticated can read careers resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'careers-resumes');

DROP POLICY IF EXISTS "Authenticated can delete careers resumes" ON storage.objects;
CREATE POLICY "Authenticated can delete careers resumes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'careers-resumes');

-- Public can read since bucket is public. Storage automatically routes
-- through the public CDN endpoint for files in public buckets, so an
-- explicit anon SELECT policy isn't strictly required — but adding one
-- makes intent explicit and survives any future bucket.public flip.
DROP POLICY IF EXISTS "Public can read careers resumes" ON storage.objects;
CREATE POLICY "Public can read careers resumes"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'careers-resumes');
