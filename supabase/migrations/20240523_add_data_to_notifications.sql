-- Add 'data' column to notifications table for storing rich metadata (JSONB)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- Ensure related_user column exists (optional check, based on other errors)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_user TEXT;
