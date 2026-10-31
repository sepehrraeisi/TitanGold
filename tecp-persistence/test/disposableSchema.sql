-- TECP-DLP-001 disposable test schema ONLY.
-- NOT a production migration. NOT migration 056/057.
-- Enforces one canonical WRITE owner per (resource_type, resource_key)
-- and a durable monotonic fencing epoch that survives lease release/recreation.

CREATE TABLE dlp_write_resource_fence (
    resource_type TEXT NOT NULL,
    resource_key TEXT NOT NULL,
    fencing_epoch BIGINT NOT NULL DEFAULT 0 CHECK (fencing_epoch >= 0),
    PRIMARY KEY (resource_type, resource_key)
);

CREATE TABLE dlp_write_lease (
    resource_type TEXT NOT NULL,
    resource_key TEXT NOT NULL,
    lease_key TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    governance_revision TEXT NOT NULL,
    fencing_epoch BIGINT NOT NULL CHECK (fencing_epoch > 0),
    version BIGINT NOT NULL CHECK (version > 0),
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RELEASED')),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    renewed_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    PRIMARY KEY (resource_type, resource_key),
    CONSTRAINT dlp_write_lease_key_unique UNIQUE (lease_key)
);

CREATE TABLE dlp_write_acquire_idempotency (
    idempotency_key TEXT PRIMARY KEY,
    resource_type TEXT NOT NULL,
    resource_key TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    governance_revision TEXT NOT NULL,
    lease_key TEXT NOT NULL,
    fencing_epoch BIGINT NOT NULL,
    version BIGINT NOT NULL,
    decision TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Fence rows are never deleted by lease release paths. Epoch only increases.
CREATE OR REPLACE FUNCTION dlp_forbid_fence_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'dlp_write_resource_fence rows must not be deleted in disposable proof';
END;
$$;

CREATE TRIGGER dlp_write_resource_fence_no_delete
    BEFORE DELETE ON dlp_write_resource_fence
    FOR EACH ROW
    EXECUTE FUNCTION dlp_forbid_fence_delete();
