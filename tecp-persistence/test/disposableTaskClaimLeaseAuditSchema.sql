-- TECP-DLP-004 disposable Task/Claim/Lease + Audit/Evidence composition grants.
-- NOT a production migration. NOT migration 056/057.
-- Does NOT redefine frozen DLP-001/002/003 tables or triggers.
-- Applied only after disposableSchema.sql + disposableTaskClaimLeaseSchema.sql
-- + disposableAuditEvidenceSchema.sql in disposable harness tests.
--
-- Creates a strict non-owner composition role with least privilege for the
-- two-phase composition proof. Does NOT claim superuser/owner bypass protection.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dlp_composition_proof') THEN
    CREATE ROLE dlp_composition_proof NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS LOGIN;
  END IF;
END
$$;

-- Hardening: composition role must never gain elevated attributes.
ALTER ROLE dlp_composition_proof NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;

GRANT CONNECT ON DATABASE dlp_proof TO dlp_composition_proof;
GRANT USAGE ON SCHEMA public TO dlp_composition_proof;

-- Task / Claim / composition idempotency (owned by harness superuser dlp_proof).
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_task TO dlp_composition_proof;
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_task_claim TO dlp_composition_proof;
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_task_claim_composition_idempotency TO dlp_composition_proof;

-- WRITE lease tables (DLP-001).
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_write_lease TO dlp_composition_proof;
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_write_acquire_idempotency TO dlp_composition_proof;
GRANT SELECT, INSERT, UPDATE ON TABLE dlp_write_resource_fence TO dlp_composition_proof;

-- Audit / Evidence: append+read only. No UPDATE/DELETE. No TRIGGER control.
GRANT SELECT, INSERT ON TABLE dlp_audit_event TO dlp_composition_proof;
GRANT SELECT, INSERT ON TABLE dlp_evidence_fact TO dlp_composition_proof;
GRANT USAGE, SELECT ON SEQUENCE dlp_audit_event_ord_seq TO dlp_composition_proof;
GRANT USAGE, SELECT ON SEQUENCE dlp_evidence_fact_ord_seq TO dlp_composition_proof;

-- Explicitly revoke dangerous privileges if previously granted.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_audit_event FROM dlp_composition_proof;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_evidence_fact FROM dlp_composition_proof;
REVOKE ALL ON TABLE dlp_audit_event FROM PUBLIC;
REVOKE ALL ON TABLE dlp_evidence_fact FROM PUBLIC;

-- Composition role must not be able to become Audit/Evidence table owner.
REVOKE dlp_audit_owner FROM dlp_composition_proof;
REVOKE dlp_audit_proof FROM dlp_composition_proof;
