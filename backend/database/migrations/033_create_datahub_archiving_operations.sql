-- Migration: 033_create_datahub_archiving_operations.sql
-- GAP-032: DataHub Advanced - Archiving API audit trail (manual ops only)

CREATE TABLE IF NOT EXISTS datahub_archiving_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_type VARCHAR(30) NOT NULL CHECK (
        operation_type IN (
            'preview_archive',
            'archive',
            'preview_restore',
            'restore',
            'preview_purge',
            'create_partition'
        )
    ),
    dry_run BOOLEAN NOT NULL DEFAULT FALSE,
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'success'
        CHECK (status IN ('success', 'failed')),
    error_summary JSONB,
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_datahub_archiving_operations_started_at
    ON datahub_archiving_operations (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_datahub_archiving_operations_type_status
    ON datahub_archiving_operations (operation_type, status);
