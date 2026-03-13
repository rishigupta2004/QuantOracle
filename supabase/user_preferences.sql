-- Run this in Supabase SQL Editor
-- This creates the user_preferences table for storing watchlists and user settings

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  watchlist JSONB DEFAULT '[]',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users (Clerk JWT)
CREATE POLICY "Users read own preferences" 
ON user_preferences FOR SELECT 
USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users insert own preferences" 
ON user_preferences FOR INSERT 
WITH CHECK (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users update own preferences" 
ON user_preferences FOR UPDATE 
USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Allow service role full access (for server-side operations)
CREATE POLICY "Service role full access"
ON user_preferences FOR ALL 
USING (auth.role() = 'service_role');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_clerk_user_id 
ON user_preferences(clerk_user_id);
