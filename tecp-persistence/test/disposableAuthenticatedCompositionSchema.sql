-- TECP-DLP-007 disposable authenticated composition grants.
-- NOT a production migration. NOT migration 056/057.
-- Does NOT redefine frozen DLP-001/002/003/004 tables, triggers or roles.
-- Applied only after disposableSchema.sql + disposableTaskClaimLeaseSchema.sql
-- + disposableAuditEvidenceSchema.sql in disposable harness tests.
--
-- Creates a strict non-owner authenticated-composition proof role with least
-- privilege for the C1 authenticated bind/release proof.
-- Does NOT claim superuser/owner bypass protection.
-- Does NOT seal public DLP-001..004 APIs (residual R1).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dlp_authz_composition_proof') THEN
    CREATE ROLE dlp_authz_composition_proof NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS LOGIN;
  END IF;
END
$$;

-- Hardening: authenticated composition role must never gain elevated attributes.
ALTER ROLE dlp_authz_composition_proof NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;

GRANT CONNECT ON DATABASE dlp_proof TO dlp_authz_composition_proof;
GRANT USAGE ON SCHEMA public TO dlp_authz_composition_proof;

-- Task / Claim / composition idempotency (owned by harness superuser dlp_proof).
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_task TO dlp_authz_composition_proof;
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_task_claim TO dlp_authz_composition_proof;
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_task_claim_composition_idempotency TO dlp_authz_composition_proof;

-- WRITE lease tables (DLP-001).
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_write_lease TO dlp_authz_composition_proof;
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_write_acquire_idempotency TO dlp_authz_composition_proof;
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_write_resource_fence TO dlp_authz_composition_proof;

-- Audit / Evidence: append+read only. No UPDATE/DELETE. No TRIGGER control.
GRANT SELECT, INSERT ON TABLE dlp_audit_event TO dlp_authz_composition_proof;
GRANT SELECT, INSERT ON TABLE dlp_evidence_fact TO dlp_authz_composition_proof;
GRANT USAGE, SELECT ON SEQUENCE dlp_audit_event_ord_seq TO dlp_authz_composition_proof;
GRANT USAGE, SELECT ON SEQUENCE dlp_evidence_fact_ord_seq TO dlp_authz_composition_proof;

-- Explicitly revoke dangerous privileges if previously granted.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_audit_event FROM dlp_authz_composition_proof;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_evidence_fact FROM dlp_authz_composition_proof;
REVOKE ALL ON TABLE dlp_audit_event FROM PUBLIC;
REVOKE ALL ON TABLE dlp_evidence_fact FROM PUBLIC;

-- Authenticated composition role must not become Audit/Evidence table owner
-- and must not inherit prior composition/audit proof roles when those roles exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dlp_audit_owner') THEN
    EXECUTE 'REVOKE dlp_audit_owner FROM dlp_authz_composition_proof';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dlp_audit_proof') THEN
    EXECUTE 'REVOKE dlp_audit_proof FROM dlp_authz_composition_proof';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dlp_composition_proof') THEN
    EXECUTE 'REVOKE dlp_composition_proof FROM dlp_authz_composition_proof';
  END IF;
END
$$;
