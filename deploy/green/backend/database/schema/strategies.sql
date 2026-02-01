-- Strategies schema for Professional Strategies tab

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS strategies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  agents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'inactive',
  roi double precision NOT NULL DEFAULT 0,
  win_rate double precision NOT NULL DEFAULT 0,
  trades integer NOT NULL DEFAULT 0,
  sharpe double precision NOT NULL DEFAULT 0,
  max_drawdown double precision NOT NULL DEFAULT 0,
  rank text NOT NULL DEFAULT 'N',
  chart_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategies_user_id ON strategies(user_id);


