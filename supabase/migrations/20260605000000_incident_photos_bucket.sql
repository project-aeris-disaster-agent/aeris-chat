-- Public Storage bucket for incident evidence photos (AERIS CHAT MVP).
--
-- Photos captured in the Report Incident modal are uploaded here server-side
-- with the service-role key, then their durable public https URL is stored in
-- disaster_reports.photo_url for the Dashboard-owned Hypercert mint path.
--
-- The bucket is PUBLIC so the URL is stable and durable (usable later as the
-- Hypercert token image via the Dashboard's imageUri override). Uploads only
-- ever happen through the service role, so no anonymous INSERT policy is added.
--
-- Idempotent: safe to re-run. file_size_limit is 5 MB (5242880 bytes) to keep
-- well within Supabase free-tier limits; client compresses before upload.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incident-photos',
  'incident-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
