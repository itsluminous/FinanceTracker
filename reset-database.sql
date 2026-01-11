-- ============================================================================
-- COMPLETE DATABASE RESET SCRIPT
-- ============================================================================
-- WARNING: This will DELETE ALL DATA and DROP ALL TABLES
-- Use this to start fresh with database-setup.sql
-- ============================================================================

-- Step 1: Drop all triggers first (to avoid dependency issues)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trigger_first_user_admin ON user_profiles;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_financial_entries_updated_at ON financial_entries;

-- Step 2: Drop all functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.set_first_user_as_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.has_edit_permission(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.delete_own_account() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Step 3: Drop all tables (in reverse dependency order)
-- Drop tables that reference other tables first
DROP TABLE IF EXISTS financial_entries CASCADE;
DROP TABLE IF EXISTS user_profile_links CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Step 4: Delete all users from auth.users
-- This will cascade delete any remaining references
DELETE FROM auth.users;

-- Step 5: Drop any remaining indexes (if they weren't dropped with tables)
DROP INDEX IF EXISTS idx_financial_entries_profile_date;
DROP INDEX IF EXISTS idx_user_profile_links_user;
DROP INDEX IF EXISTS idx_user_profile_links_profile;
DROP INDEX IF EXISTS idx_user_profiles_role;

-- Step 6: Verify everything is clean
-- Run these queries to confirm nothing remains:

-- Check for remaining tables
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('user_profiles', 'profiles', 'user_profile_links', 'financial_entries');
-- Expected: 0 rows

-- Check for remaining functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('handle_new_user', 'set_first_user_as_admin', 'is_admin', 'has_edit_permission', 'delete_own_account', 'update_updated_at_column');
-- Expected: 0 rows

-- Check for remaining triggers
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name IN ('on_auth_user_created', 'trigger_first_user_admin', 'update_user_profiles_updated_at', 'update_profiles_updated_at', 'update_financial_entries_updated_at');
-- Expected: 0 rows

-- Check auth.users is empty
SELECT COUNT(*) as user_count FROM auth.users;
-- Expected: 0

-- ============================================================================
-- NEXT STEPS AFTER RUNNING THIS SCRIPT:
-- ============================================================================
-- 1. Verify all checks above return 0 rows/count
-- 2. Run the complete database-setup.sql file
-- 3. Verify the trigger was created with verify-trigger-setup.sql
-- 4. Test signup flow
-- ============================================================================

