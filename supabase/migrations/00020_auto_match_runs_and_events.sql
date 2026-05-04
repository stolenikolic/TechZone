-- Auto-match observability: run summaries + event stream.

CREATE TABLE IF NOT EXISTS match_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'manual_batch',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  scanned integer NOT NULL DEFAULT 0,
  linked integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS match_run_events (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES match_runs(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  supplier_product_id text,
  matched_product_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_runs_started_at ON match_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_runs_status ON match_runs(status);
CREATE INDEX IF NOT EXISTS idx_match_run_events_run_created ON match_run_events(run_id, created_at DESC);
