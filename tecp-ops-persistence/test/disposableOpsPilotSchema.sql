-- TECP-OPS-PILOT-001 CP2-I disposable schema SOURCE ONLY.
-- NOT executed in CP2-I. NOT a production migration. NOT migration 057.
-- CP2_DB_AUTHORIZED = NO for this checkpoint.
--
-- Intended future disposable application order (CP2-DB gate only):
--   1) tecp-persistence/test/disposableSchema.sql
--   2) tecp-persistence/test/disposableTaskClaimLeaseSchema.sql
--   3) tecp-persistence/test/disposableAuditEvidenceSchema.sql
--   4) tecp-persistence/test/disposableTaskClaimLeaseAuditSchema.sql
--   5) this file (role hardening for ops-pilot composition)
--
-- Does NOT redefine frozen DLP-001..004 tables.
-- Does NOT authorize cluster bootstrap tools, SQL execution or remote DB access.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tecp_ops_pilot_composition_proof') THEN
    CREATE ROLE tecp_ops_pilot_composition_proof
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT LOGIN;
  END IF;
END
$$;

ALTER ROLE tecp_ops_pilot_composition_proof
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;

-- Least-privilege grants mirror DLP-004 composition posture for future disposable use.
-- These statements must not be applied outside a separately Owner-authorized CP2-DB harness.

GRANT CONNECT ON DATABASE dlp_proof TO tecp_ops_pilot_composition_proof;
GRANT USAGE ON SCHEMA public TO tecp_ops_pilot_composition_proof;

GRANT SELECT, INSERT, UPDATE ON TABLE dlp_task TO tecp_ops_pilot_composition_proof;
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_task_claim TO tecp_ops_pilot_composition_proof;
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_task_claim_composition_idempotency
  TO tecp_ops_pilot_composition_proof;
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_write_lease TO tecp_ops_pilot_composition_proof;
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_write_acquire_idempotency
  TO tecp_ops_pilot_composition_proof;
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_write_resource_fence
  TO tecp_ops_pilot_composition_proof;

GRANT SELECT, INSERT ON TABLE dlp_audit_event TO tecp_ops_pilot_composition_proof;
GRANT SELECT, INSERT ON TABLE dlp_evidence_fact TO tecp_ops_pilot_composition_proof;
GRANT USAGE, SELECT ON SEQUENCE dlp_audit_event_ord_seq TO tecp_ops_pilot_composition_proof;
GRANT USAGE, SELECT ON SEQUENCE dlp_evidence_fact_ord_seq TO tecp_ops_pilot_composition_proof;

REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE dlp_audit_event FROM tecp_ops_pilot_composition_proof;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE dlp_evidence_fact FROM tecp_ops_pilot_composition_proof;

-- Explicit non-claims for CP2-I offline:
-- * Real concurrent fencing against PostgreSQL = NOT_RUN / CP2_DB_REQUIRED
-- * Durable immutable audit enforcement = NOT_RUN / CP2_DB_REQUIRED
-- * Crash recovery / unknown txn outcome = NOT_RUN / CP2_DB_REQUIRED
