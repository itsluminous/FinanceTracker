-- Fix for user profile creation during signup
-- This creates a database function that bypasses RLS to create user profiles

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  -- Check if this is the first user
  SELECT NOT EXISTS (SELECT 1 FROM user_profiles LIMIT 1) INTO is_first_user;
  
  -- Insert into user_profiles
  INSERT INTO user_profiles (id, email, role, approved_at)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN is_first_user THEN 'admin' ELSE 'pending' END,
    CASE WHEN is_first_user THEN NOW() ELSE NULL END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON auth.users TO postgres, anon, authenticated, service_role;
