-- Migration: 032_add_prioritization_audit_columns.sql
-- GAP-030 audit trail hardening (runs table)

ALTER TABLE datahub_prioritization_runs
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS applied_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS settings_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS preview_only BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'success'
  CHECK (status IN ('success', 'failed')),
ADD COLUMN IF NOT EXISTS error_summary JSONB;

