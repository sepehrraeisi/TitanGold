-- TECP-DLP-003 disposable immutable Audit/Evidence append schema ONLY.
-- NOT a production migration. NOT migration 056/057.
-- Applied only in disposable harness tests after createProofDatabase().
--
-- Immutability (BOTH required):
--   1) Restrictive privileges for proof role dlp_audit_proof (INSERT+SELECT only).
--   2) BEFORE UPDATE OR DELETE triggers that RAISE EXCEPTION fail-closed.
-- Does NOT claim protection against PostgreSQL superuser or table owner.
-- No hash-chain integrity claim.

-- Non-superuser proof role used by normal append/read tests.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dlp_audit_proof') THEN
    CREATE ROLE dlp_audit_proof NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dlp_audit_owner') THEN
    CREATE ROLE dlp_audit_owner NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE dlp_proof TO dlp_audit_proof;
GRANT CONNECT ON DATABASE dlp_proof TO dlp_audit_owner;
GRANT USAGE ON SCHEMA public TO dlp_audit_proof;
GRANT USAGE ON SCHEMA public TO dlp_audit_owner;

CREATE SEQUENCE dlp_audit_event_ord_seq AS BIGINT START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE dlp_evidence_fact_ord_seq AS BIGINT START WITH 1 INCREMENT BY 1;

CREATE TABLE dlp_audit_event (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    task_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    governance_revision TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    ord BIGINT NOT NULL DEFAULT nextval('dlp_audit_event_ord_seq'),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT dlp_audit_event_idempotency_unique UNIQUE (idempotency_key),
    CONSTRAINT dlp_audit_event_ord_unique UNIQUE (ord)
);

CREATE TABLE dlp_evidence_fact (
    evidence_id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    governance_revision TEXT NOT NULL,
    evidence_type TEXT NOT NULL,
    evidence_ref TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    ord BIGINT NOT NULL DEFAULT nextval('dlp_evidence_fact_ord_seq'),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT dlp_evidence_fact_idempotency_unique UNIQUE (idempotency_key),
    CONSTRAINT dlp_evidence_fact_ord_unique UNIQUE (ord)
);

CREATE OR REPLACE FUNCTION dlp_audit_evidence_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'DLP003_IMMUTABLE_ROW: % on % is forbidden', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER dlp_audit_event_immutable_trg
  BEFORE UPDATE OR DELETE ON dlp_audit_event
  FOR EACH ROW
  EXECUTE FUNCTION dlp_audit_evidence_reject_mutation();

CREATE TRIGGER dlp_evidence_fact_immutable_trg
  BEFORE UPDATE OR DELETE ON dlp_evidence_fact
  FOR EACH ROW
  EXECUTE FUNCTION dlp_audit_evidence_reject_mutation();

ALTER TABLE dlp_audit_event OWNER TO dlp_audit_owner;
ALTER TABLE dlp_evidence_fact OWNER TO dlp_audit_owner;
ALTER SEQUENCE dlp_audit_event_ord_seq OWNER TO dlp_audit_owner;
ALTER SEQUENCE dlp_evidence_fact_ord_seq OWNER TO dlp_audit_owner;
ALTER FUNCTION dlp_audit_evidence_reject_mutation() OWNER TO dlp_audit_owner;

-- Proof role: append + read only. No UPDATE/DELETE privilege.
REVOKE ALL ON TABLE dlp_audit_event FROM PUBLIC;
REVOKE ALL ON TABLE dlp_evidence_fact FROM PUBLIC;
REVOKE ALL ON SEQUENCE dlp_audit_event_ord_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE dlp_evidence_fact_ord_seq FROM PUBLIC;

GRANT SELECT, INSERT ON TABLE dlp_audit_event TO dlp_audit_proof;
GRANT SELECT, INSERT ON TABLE dlp_evidence_fact TO dlp_audit_proof;
GRANT USAGE, SELECT ON SEQUENCE dlp_audit_event_ord_seq TO dlp_audit_proof;
GRANT USAGE, SELECT ON SEQUENCE dlp_evidence_fact_ord_seq TO dlp_audit_proof;

-- Owner retains full DML so trigger rejection can be proven when privileges allow.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE dlp_audit_event TO dlp_audit_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE dlp_evidence_fact TO dlp_audit_owner;
GRANT USAGE, SELECT ON SEQUENCE dlp_audit_event_ord_seq TO dlp_audit_owner;
GRANT USAGE, SELECT ON SEQUENCE dlp_evidence_fact_ord_seq TO dlp_audit_owner;
