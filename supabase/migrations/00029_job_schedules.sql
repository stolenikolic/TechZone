-- 00029_job_schedules.sql
-- Per-job-type pause/run flags consumed by the GitHub Actions cron workflow
-- and by the admin UI. The workflow checks `is_paused` before invoking the
-- corresponding script, so the admin can stop a noisy job without touching CI.

CREATE TABLE IF NOT EXISTS public.job_schedules (
  job_type text PRIMARY KEY,
  is_paused boolean NOT NULL DEFAULT false,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.job_schedules (job_type, is_paused)
VALUES
  ('ipon_import', false),
  ('ipon_scrape_details', false),
  ('pcx_import', false),
  ('aggregate_prices', false),
  ('auto_match', false)
ON CONFLICT (job_type) DO NOTHING;
