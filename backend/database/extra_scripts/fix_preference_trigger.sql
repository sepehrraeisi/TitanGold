-- Fix trigger function to handle NULL values properly
CREATE OR REPLACE FUNCTION log_preference_change()
RETURNS TRIGGER AS $$
DECLARE
    change_type_val VARCHAR(20);
    target_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        change_type_val = 'create';
        target_user_id = NEW.user_id;
    ELSIF TG_OP = 'UPDATE' THEN
        change_type_val = 'update';
        target_user_id = NEW.user_id;
    ELSIF TG_OP = 'DELETE' THEN
        change_type_val = 'delete';
        target_user_id = OLD.user_id;
    END IF;

    -- Skip logging if user_id is NULL (shouldn't happen, but safety check)
    IF target_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO preference_change_history (
        user_id,
        change_type,
        old_values,
        new_values,
        old_version,
        new_version,
        sync_source,
        device_fingerprint,
        ip_address,
        changed_by
    ) VALUES (
        target_user_id,
        change_type_val,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.preferences ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.preferences ELSE NULL END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.version ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.version ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.sync_source ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.device_fingerprint ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.ip_address ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.updated_by ELSE NULL END
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_log_preference_change ON user_preferences;
CREATE TRIGGER trigger_log_preference_change
    AFTER INSERT OR UPDATE OR DELETE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION log_preference_change();

-- Test the fix
SELECT 'Trigger function fixed successfully!' as status;
