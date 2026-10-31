-- TECP-DLP-002 disposable Task/Claim composition schema ONLY.
-- Additive to DLP-001 disposableSchema.sql. NOT a production migration.
-- NOT migration 056/057. Applied only in disposable harness tests.

CREATE TABLE dlp_task (
    task_id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    governance_revision TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('READY', 'CLAIMED', 'RELEASED')),
    resource_type TEXT NOT NULL,
    resource_key TEXT NOT NULL,
    claim_key TEXT NOT NULL,
    composition_idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT dlp_task_task_claim_key_unique UNIQUE (claim_key),
    CONSTRAINT dlp_task_composition_idempotency_unique UNIQUE (composition_idempotency_key)
);

CREATE TABLE dlp_task_claim (
    task_id TEXT NOT NULL REFERENCES dlp_task (task_id),
    resource_type TEXT NOT NULL,
    resource_key TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    claim_key TEXT NOT NULL,
    access_mode TEXT NOT NULL CHECK (access_mode = 'WRITE'),
    status TEXT NOT NULL CHECK (status IN ('HELD', 'RELEASED')),
    governance_revision TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    released_at TIMESTAMPTZ,
    PRIMARY KEY (task_id, resource_type, resource_key),
    CONSTRAINT dlp_task_claim_claim_key_unique UNIQUE (claim_key)
);

-- Exactly one HELD WRITE claim owner per resource.
CREATE UNIQUE INDEX dlp_task_claim_one_held_owner
    ON dlp_task_claim (resource_type, resource_key)
    WHERE status = 'HELD';

CREATE TABLE dlp_task_claim_composition_idempotency (
    composition_idempotency_key TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_key TEXT NOT NULL,
    claim_key TEXT NOT NULL,
    lease_key TEXT NOT NULL,
    governance_revision TEXT NOT NULL,
    fencing_epoch BIGINT NOT NULL,
    lease_version BIGINT NOT NULL,
    decision TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
