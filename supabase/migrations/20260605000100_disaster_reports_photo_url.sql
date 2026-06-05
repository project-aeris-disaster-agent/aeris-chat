-- Ensure disaster_reports has a photo_url column for evidence media.
--
-- AERIS CHAT uploads a single evidence photo to the incident-photos Storage
-- bucket and saves the durable public https URL here. The Dashboard reads
-- photo_url and may later wire it into the Hypercert token image (imageUri
-- override). Column is nullable; reports without evidence are still valid.
--
-- disaster_reports is owned by AERIS DASHBOARD in the shared Supabase project.
-- This ADD COLUMN IF NOT EXISTS is idempotent and safe even if the Dashboard
-- has already created the column.

ALTER TABLE public.disaster_reports
  ADD COLUMN IF NOT EXISTS photo_url text;
