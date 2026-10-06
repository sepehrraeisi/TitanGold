-- TECP-004 DATABASE FOUNDATION
-- Schema: public
-- Table prefix: tecp_
-- Exactly six tables. No extra tables, schema, extension, function, trigger, or seed.
-- Fail-closed: CREATE TABLE (no IF NOT EXISTS).
-- Transaction ownership: node-pg-migrate (no manual BEGIN/COMMIT).
-- DO NOT execute against live DB until Owner explicitly authorizes.

-- Up Migration

CREATE TABLE public.tecp_projects (
    id BIGSERIAL PRIMARY KEY,
    project_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.tecp_actors (
    id BIGSERIAL PRIMARY KEY,
    actor_key TEXT NOT NULL UNIQUE,
    actor_type TEXT NOT NULL,
    display_name TEXT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NULL
);

CREATE TABLE public.tecp_tasks (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES public.tecp_projects (id),
    external_key TEXT NOT NULL UNIQUE,
    parent_task_id BIGINT NULL REFERENCES public.tecp_tasks (id),
    title TEXT NOT NULL,
    state TEXT NOT NULL,
    risk_tier SMALLINT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    authorization_status TEXT NOT NULL,
    governance_revision TEXT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ NULL
);

CREATE TABLE public.tecp_task_dependencies (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES public.tecp_tasks (id),
    depends_on_task_id BIGINT NOT NULL REFERENCES public.tecp_tasks (id),
    dependency_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tecp_task_dependencies_task_id_depends_on_task_id_key UNIQUE (task_id, depends_on_task_id),
    CONSTRAINT tecp_task_dependencies_no_self_chk CHECK (task_id <> depends_on_task_id)
);

CREATE TABLE public.tecp_task_resource_claims (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES public.tecp_tasks (id),
    resource_type TEXT NOT NULL,
    resource_key TEXT NOT NULL,
    access_mode TEXT NOT NULL,
    criticality TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.tecp_leases (
    id BIGSERIAL PRIMARY KEY,
    lease_key TEXT NOT NULL UNIQUE,
    task_id BIGINT NOT NULL REFERENCES public.tecp_tasks (id),
    actor_id BIGINT NOT NULL REFERENCES public.tecp_actors (id),
    lease_type TEXT NOT NULL,
    status TEXT NOT NULL,
    governance_revision TEXT NOT NULL,
    branch_name TEXT NULL,
    worktree_path TEXT NULL,
    heartbeat_at TIMESTAMPTZ NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ NULL,
    version BIGINT NOT NULL DEFAULT 1
);

-- Down Migration

DROP TABLE IF EXISTS public.tecp_leases;
DROP TABLE IF EXISTS public.tecp_task_resource_claims;
DROP TABLE IF EXISTS public.tecp_task_dependencies;
DROP TABLE IF EXISTS public.tecp_tasks;
DROP TABLE IF EXISTS public.tecp_actors;
DROP TABLE IF EXISTS public.tecp_projects;
