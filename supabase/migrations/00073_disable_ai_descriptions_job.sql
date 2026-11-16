-- AI opisi se ne pokreću. Job ostaje u job_schedules da admin vidi da je ugašen.

UPDATE public.job_schedules
SET
  is_paused = true,
  notes = 'Ugašeno. Nema ga u nightly pipelineu ni u ručnom pokretanju.',
  updated_at = now()
WHERE job_type = 'ai_descriptions';
