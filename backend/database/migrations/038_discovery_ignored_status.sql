-- DH-AUTODISCOVERY-P2: add ignored suggestion status

ALTER TABLE datahub_discovery_suggestions
    DROP CONSTRAINT IF EXISTS datahub_discovery_suggestions_status_check;

ALTER TABLE datahub_discovery_suggestions
    ADD CONSTRAINT datahub_discovery_suggestions_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate', 'ignored'));
