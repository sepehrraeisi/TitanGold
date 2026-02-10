-- Fix increment_preference_version to handle both INSERT and UPDATE
CREATE OR REPLACE FUNCTION increment_preference_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only increment version on UPDATE, not INSERT
    IF TG_OP = 'UPDATE' THEN
        NEW.version = OLD.version + 1;
    ELSE
        -- On INSERT, use default version (1)
        NEW.version = COALESCE(NEW.version, 1);
    END IF;
    
    NEW.last_sync_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trigger to fire on INSERT as well
DROP TRIGGER IF EXISTS trigger_increment_preference_version ON user_preferences;
CREATE TRIGGER trigger_increment_preference_version
    BEFORE INSERT OR UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION increment_preference_version();

SELECT 'Trigger fixed for INSERT and UPDATE!' as status;
