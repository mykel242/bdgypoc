-- Migration: Add is_locked and is_archived columns to ledgers table
-- Run this on existing databases to add the new columns

-- Add is_locked column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ledgers' AND column_name = 'is_locked'
    ) THEN
        ALTER TABLE ledgers ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add is_archived column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ledgers' AND column_name = 'is_archived'
    ) THEN
        ALTER TABLE ledgers ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
