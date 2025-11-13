-- Migration: Fix sessions table schema
-- Drop the manually created sessions table and let connect-session-sequelize create it

-- Drop existing sessions table if it exists
DROP TABLE IF EXISTS sessions CASCADE;

-- The sessions table will be auto-created by connect-session-sequelize
-- with the correct schema: sid, expires, data, createdAt, updatedAt
