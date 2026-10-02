-- Delete User Script
-- Replace 'user-email@example.com' with the actual email address

-- Step 1: Get the user ID (run this first to get the UUID)
SELECT id, email FROM auth.users WHERE email = 'user-email@example.com';

-- Step 2: Delete from user_profiles (this will cascade to user_profile_links)
-- Replace 'USER_UUID_HERE' with the UUID from step 1
DELETE FROM user_profiles WHERE id = 'USER_UUID_HERE';

-- Step 3: Delete from auth.users (this will cascade to everything)
-- Replace 'USER_UUID_HERE' with the UUID from step 1
DELETE FROM auth.users WHERE id = 'USER_UUID_HERE';

-- Alternative: Delete by email directly (combines all steps)
-- Replace 'user-email@example.com' with the actual email
DELETE FROM user_profiles WHERE id IN (SELECT id FROM auth.users WHERE email = 'user-email@example.com');
DELETE FROM auth.users WHERE email = 'user-email@example.com';
