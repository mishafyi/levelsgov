-- 001-posts.sql — content posts written by workers/journalist (ai-journalist).
-- Apply: psql "$DATABASE_URL" -f scripts/migrations/001-posts.sql   (idempotent)
CREATE TABLE IF NOT EXISTS posts (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  description    TEXT,
  markdown       TEXT NOT NULL,
  byline         TEXT,
  target_keyword TEXT,
  entities       TEXT[] NOT NULL DEFAULT '{}',   -- agencies/occupations named (anti-repetition feed)
  telemetry      JSONB,                          -- the run's gate telemetry snapshot
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_status_published_at_idx
  ON posts (status, published_at DESC);
