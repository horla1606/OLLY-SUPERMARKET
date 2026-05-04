-- =============================================
-- Migration 001: Passwordless email-based auth
-- Run in Supabase SQL Editor
-- =============================================

-- Make password_hash nullable (email is now the sole credential)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Allow 'manager' as a valid role alongside existing roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('customer', 'manager', 'admin', 'staff'));
