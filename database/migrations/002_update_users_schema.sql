-- Migration: Update users table schema
-- Adds uuid, first_name, last_name columns and removes username column

-- Add uuid column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='users' AND column_name='uuid') THEN
        ALTER TABLE users ADD COLUMN uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid();
    END IF;
END $$;

-- Add first_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='users' AND column_name='first_name') THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(100) NOT NULL DEFAULT 'User';
    END IF;
END $$;

-- Add last_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='users' AND column_name='last_name') THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(100) NOT NULL DEFAULT 'Name';
    END IF;
END $$;

-- Drop username column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='users' AND column_name='username') THEN
        ALTER TABLE users DROP COLUMN username;
    END IF;
END $$;
