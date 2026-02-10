-- Migration: 016_encrypt_credentials.sql
-- Task: TASK-DF-005 - Encrypt credentials column
-- Description: Adds comments and ensures credentials are treated as sensitive data
-- Date: 2026-02-03

-- Note: The column already exists as JSONB. 
-- This migration serves as a marker for the encryption logic implementation.

COMMENT ON COLUMN data_sources.credentials IS 'Sensitive credentials stored as encrypted JSON: {"encrypted": "iv:ciphertext:authTag"}';

-- If there were existing plain-text credentials, we would migrate them here.
-- Since the database is currently empty of data sources, no data migration is needed.
