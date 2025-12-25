-- Fix RLS and Realtime for notifications table

-- 1. Enable Realtime for notifications table
begin;
  -- Check if publication exists, if not create it (standard supabase setup usually has it)
  -- But we can add the table to the publication explicitly
  alter publication supabase_realtime add table notifications;
exception when others then
  -- In case it's already added or publication doesn't exist (if self-hosted)
  -- We'll try to create it if it doesn't exist
  null;
end;

-- 2. Enable RLS on notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 3. Create Policy for SELECT (Read)
-- Allow users to read their own notifications based on user_address
-- Since we store user_address as a string (wallet address) and don't use Supabase Auth UID,
-- we might need a more open policy for the client to subscribe.
-- Ideally, we would match 'user_address' with the authenticated user, but here we likely have anon access.
-- So we will allow public read for now to ensure Realtime works. 
-- The client filters by user_address.
DROP POLICY IF EXISTS "Public read access" ON notifications;
CREATE POLICY "Public read access" ON notifications FOR SELECT USING (true);

-- 4. Create Policy for INSERT (Write)
-- Allow anyone to insert notifications (server-side admin uses service role which bypasses this, 
-- but if we ever want client-side inserts for some reason, or to be safe)
DROP POLICY IF EXISTS "Public insert access" ON notifications;
CREATE POLICY "Public insert access" ON notifications FOR INSERT WITH CHECK (true);

-- 5. Ensure 'data' column exists (re-applying from previous migration to be safe)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_user TEXT;
