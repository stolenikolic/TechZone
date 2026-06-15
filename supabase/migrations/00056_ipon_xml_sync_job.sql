-- iPon XML feed sync job (cijene + deaktivacija, cron svakih 2h)
INSERT INTO public.job_schedules (job_type, is_paused)
VALUES ('ipon_xml_sync', false)
ON CONFLICT (job_type) DO NOTHING;
