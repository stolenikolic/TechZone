-- Add enrichment to job_schedules (pause/run from /admin/jobs)
INSERT INTO public.job_schedules (job_type, is_paused)
VALUES ('enrichment', false)
ON CONFLICT (job_type) DO NOTHING;
