-- Add is_active column to data_sources if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_sources' AND column_name = 'is_active') THEN
        ALTER TABLE data_sources ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;
