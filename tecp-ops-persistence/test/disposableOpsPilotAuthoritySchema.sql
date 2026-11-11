-- TECP-OPS-PILOT-001 S2 disposable authority schema SOURCE ONLY.
-- Gate C+D remediation: SQL templates ready for future Tier-3 disposable PG.
-- NOT executed during remediation. NOT a production migration. NOT migration 056/057.
-- CP2_DB_AUTHORIZED = NO / POSTGRES_EXECUTION_AUTHORIZED = NO until separate Owner gate.
--
-- Purpose: durable jti presentation uniqueness + revocation records for a future
-- Owner-authorized disposable PostgreSQL proof. Transactionally safe replay
-- rejection depends on PRIMARY KEY uniqueness and owned-transaction usage.
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
  issuer_id TEXT NOT NULL,
  audience TEXT NOT NULL,
  presented_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tecp_ops_authority_jti_nonempty CHECK (char_length(jti) > 0),
  CONSTRAINT tecp_ops_authority_jti_issuer_nonempty CHECK (char_length(issuer_id) > 0),
  CONSTRAINT tecp_ops_authority_jti_audience_nonempty CHECK (char_length(audience) > 0)
);

CREATE TABLE IF NOT EXISTS tecp_ops_authority_revocation (
  jti TEXT PRIMARY KEY,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  reason TEXT NOT NULL,
  governance_revision TEXT NOT NULL,
  issuer_id TEXT NOT NULL,
  audience TEXT NOT NULL,
  CONSTRAINT tecp_ops_authority_revocation_nonempty CHECK (char_length(jti) > 0),
  CONSTRAINT tecp_ops_authority_revocation_issuer_nonempty CHECK (char_length(issuer_id) > 0),
  CONSTRAINT tecp_ops_authority_revocation_audience_nonempty CHECK (char_length(audience) > 0)
);

-- Concurrent duplicate jti consume fails with unique_violation (23505) on PRIMARY KEY.
CREATE UNIQUE INDEX IF NOT EXISTS tecp_ops_authority_jti_presentation_pk_idx
  ON tecp_ops_authority_jti_presentation (jti);
CREATE UNIQUE INDEX IF NOT EXISTS tecp_ops_authority_revocation_pk_idx
  ON tecp_ops_authority_revocation (jti);

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

-- Explicit non-claims until Tier-3 disposable PostgreSQL executes this schema:
-- * Real UNIQUE conflict under concurrent PostgreSQL = NOT_RUN / TIER3_REQUIRED
-- * Atomic jti consume with DLP-004 txn = NOT_RUN / TIER3_REQUIRED
-- * Production role isolation = NOT_PROVEN
