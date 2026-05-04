-- Public dashboard consumers may read visible, non-rejected reports.
-- Writes still require server-side service-role access or an authenticated
-- user-owned insert policy.

CREATE POLICY "Public can view visible disaster reports"
  ON public.disaster_reports FOR SELECT
  USING (
    moderation_status = 'visible'
    AND verification_status <> 'rejected'
  );
