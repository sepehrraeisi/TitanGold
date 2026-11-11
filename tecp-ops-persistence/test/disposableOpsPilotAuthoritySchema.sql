-- TECP-OPS-PILOT-001 S2 disposable authority schema SOURCE ONLY.
-- NOT executed in Gate B. NOT a production migration. NOT migration 056/057.
-- CP2_DB_AUTHORIZED = NO / POSTGRES_EXECUTION_AUTHORIZED = NO for this checkpoint.
--
-- Purpose: durable jti presentation uniqueness + revocation records for a future
-- Owner-authorized disposable PostgreSQL proof (Gate C/D). Transactionally safe
-- replay rejection depends on UNIQUE constraints and owned-transaction usage.
--
-- Does NOT redefine frozen DLP-001..004 tables.
-- Does NOT authorize cluster bootstrap, SQL execution or remote DB access.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tecp_ops_pilot_authority_proof') THEN
    CREATE ROLE tecp_ops_pilot_authority_proof
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tecp_ops_pilot_authority_reader') THEN
    CREATE ROLE tecp_ops_pilot_authority_reader
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT LOGIN;
  END IF;
END
$$;

ALTER ROLE tecp_ops_pilot_authority_proof
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
ALTER ROLE tecp_ops_pilot_authority_reader
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;

CREATE TABLE IF NOT EXISTS tecp_ops_authority_jti_presentation (
  jti TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_key TEXT NOT NULL,
  governance_revision TEXT NOT NULL,
  presented_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tecp_ops_authority_jti_nonempty CHECK (char_length(jti) > 0)
);

CREATE TABLE IF NOT EXISTS tecp_ops_authority_revocation (
  jti TEXT PRIMARY KEY,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  reason TEXT NOT NULL,
  governance_revision TEXT NOT NULL,
  CONSTRAINT tecp_ops_authority_revocation_nonempty CHECK (char_length(jti) > 0)
);

-- Least-privilege: writer may insert presentation/revocation; reader select-only.
GRANT CONNECT ON DATABASE dlp_proof TO tecp_ops_pilot_authority_proof;
GRANT CONNECT ON DATABASE dlp_proof TO tecp_ops_pilot_authority_reader;
GRANT USAGE ON SCHEMA public TO tecp_ops_pilot_authority_proof;
GRANT USAGE ON SCHEMA public TO tecp_ops_pilot_authority_reader;

GRANT SELECT, INSERT ON TABLE tecp_ops_authority_jti_presentation
  TO tecp_ops_pilot_authority_proof;
GRANT SELECT, INSERT ON TABLE tecp_ops_authority_revocation
  TO tecp_ops_pilot_authority_proof;
GRANT SELECT ON TABLE tecp_ops_authority_jti_presentation
  TO tecp_ops_pilot_authority_reader;
GRANT SELECT ON TABLE tecp_ops_authority_revocation
  TO tecp_ops_pilot_authority_reader;

REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE tecp_ops_authority_jti_presentation FROM tecp_ops_pilot_authority_proof;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE tecp_ops_authority_revocation FROM tecp_ops_pilot_authority_proof;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE tecp_ops_authority_jti_presentation FROM tecp_ops_pilot_authority_reader;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE tecp_ops_authority_revocation FROM tecp_ops_pilot_authority_reader;

-- Explicit Gate B non-claims:
-- * Real UNIQUE conflict under concurrent PostgreSQL = NOT_RUN / CP2_DB_REQUIRED
-- * Atomic jti consume with DLP-004 txn = NOT_RUN / GATE_D_REQUIRED
-- * Production role isolation = NOT_PROVEN
