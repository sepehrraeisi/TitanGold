-- TECP-DLP-008 D1 disposable hybrid sealed-write grants.
-- NOT a production migration. NOT migration 056/057.
-- Does NOT redefine frozen DLP-001..007 tables, triggers or roles.
-- Applied only after disposableSchema.sql + disposableTaskClaimLeaseSchema.sql
-- + disposableAuditEvidenceSchema.sql + disposableAuthenticatedCompositionSchema.sql.
--
-- Creates RESTRICTED_CALLER_ROLE with no protected DML.
-- TRUSTED_WRITER_ROLE reuses frozen dlp_authz_composition_proof (DLP-007).
-- Does NOT claim superuser/owner bypass protection.
-- Does NOT claim LOCAL_SOCKET_TRUST role-impersonation sealing.
-- Does NOT remove public DLP-001..004 JavaScript exports.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dlp_sealed_restricted_caller') THEN
    CREATE ROLE dlp_sealed_restricted_caller NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT LOGIN;
  END IF;
END
$$;

ALTER ROLE dlp_sealed_restricted_caller NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;

GRANT CONNECT ON DATABASE dlp_proof TO dlp_sealed_restricted_caller;
GRANT USAGE ON SCHEMA public TO dlp_sealed_restricted_caller;

-- SELECT only where required for privilege / session verification.
GRANT SELECT ON TABLE dlp_task TO dlp_sealed_restricted_caller;
GRANT SELECT ON TABLE dlp_task_claim TO dlp_sealed_restricted_caller;
GRANT SELECT ON TABLE dlp_task_claim_composition_idempotency TO dlp_sealed_restricted_caller;
GRANT SELECT ON TABLE dlp_write_lease TO dlp_sealed_restricted_caller;
GRANT SELECT ON TABLE dlp_write_acquire_idempotency TO dlp_sealed_restricted_caller;
GRANT SELECT ON TABLE dlp_write_resource_fence TO dlp_sealed_restricted_caller;
GRANT SELECT ON TABLE dlp_audit_event TO dlp_sealed_restricted_caller;
GRANT SELECT ON TABLE dlp_evidence_fact TO dlp_sealed_restricted_caller;

-- Explicitly deny all protected DML and privilege-control paths.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_task FROM dlp_sealed_restricted_caller;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_task_claim FROM dlp_sealed_restricted_caller;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_task_claim_composition_idempotency FROM dlp_sealed_restricted_caller;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_write_lease FROM dlp_sealed_restricted_caller;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_write_acquire_idempotency FROM dlp_sealed_restricted_caller;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_write_resource_fence FROM dlp_sealed_restricted_caller;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_audit_event FROM dlp_sealed_restricted_caller;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_evidence_fact FROM dlp_sealed_restricted_caller;

REVOKE ALL ON SEQUENCE dlp_audit_event_ord_seq FROM dlp_sealed_restricted_caller;
REVOKE ALL ON SEQUENCE dlp_evidence_fact_ord_seq FROM dlp_sealed_restricted_caller;

-- PUBLIC must not confer DML that would defeat restricted-role sealing.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_task FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_task_claim FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_task_claim_composition_idempotency FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_write_lease FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_write_acquire_idempotency FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_write_resource_fence FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_audit_event FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE dlp_evidence_fact FROM PUBLIC;

-- Restricted caller must not inherit writer/owner/composition/audit roles.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dlp_authz_composition_proof') THEN
    EXECUTE 'REVOKE dlp_authz_composition_proof FROM dlp_sealed_restricted_caller';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dlp_composition_proof') THEN
    EXECUTE 'REVOKE dlp_composition_proof FROM dlp_sealed_restricted_caller';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dlp_audit_owner') THEN
    EXECUTE 'REVOKE dlp_audit_owner FROM dlp_sealed_restricted_caller';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dlp_audit_proof') THEN
    EXECUTE 'REVOKE dlp_audit_proof FROM dlp_sealed_restricted_caller';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dlp_proof') THEN
    EXECUTE 'REVOKE dlp_proof FROM dlp_sealed_restricted_caller';
  END IF;
END
$$;
