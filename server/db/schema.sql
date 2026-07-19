CREATE TABLE IF NOT EXISTS synthetic_demo_runs (
  run_id UUID PRIMARY KEY,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS synthetic_demo_runs_expires_at_idx
  ON synthetic_demo_runs (expires_at);
