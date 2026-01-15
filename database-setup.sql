-- Personal Finance Tracker Database Setup
-- This file contains all table definitions, indexes, RLS policies, and helper functions

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- User profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('admin', 'approved', 'pending', 'rejected')),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles table (independent financial entities)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User-Profile links (many-to-many with permissions)
CREATE TABLE IF NOT EXISTS user_profile_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('read', 'edit')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, profile_id)
);

-- Financial entries table
CREATE TABLE IF NOT EXISTS financial_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  
  -- High/Medium Risk Assets
  direct_equity DECIMAL(15, 2) DEFAULT 0,
  esops DECIMAL(15, 2) DEFAULT 0,
  equity_pms DECIMAL(15, 2) DEFAULT 0,
  ulip DECIMAL(15, 2) DEFAULT 0,
  real_estate DECIMAL(15, 2) DEFAULT 0,
  real_estate_funds DECIMAL(15, 2) DEFAULT 0,
  private_equity DECIMAL(15, 2) DEFAULT 0,
  equity_mutual_funds DECIMAL(15, 2) DEFAULT 0,
  structured_products_equity DECIMAL(15, 2) DEFAULT 0,
  total_high_medium_risk DECIMAL(15, 2) GENERATED ALWAYS AS (
    direct_equity + esops + equity_pms + ulip + real_estate + 
    real_estate_funds + private_equity + equity_mutual_funds + 
    structured_products_equity
  ) STORED,
  
  -- Low Risk Assets
  bank_balance DECIMAL(15, 2) DEFAULT 0,
  debt_mutual_funds DECIMAL(15, 2) DEFAULT 0,
  endowment_plans DECIMAL(15, 2) DEFAULT 0,
  fixed_deposits DECIMAL(15, 2) DEFAULT 0,
  nps DECIMAL(15, 2) DEFAULT 0,
  epf DECIMAL(15, 2) DEFAULT 0,
  ppf DECIMAL(15, 2) DEFAULT 0,
  structured_products_debt DECIMAL(15, 2) DEFAULT 0,
  gold_etfs_funds DECIMAL(15, 2) DEFAULT 0,
  total_low_risk DECIMAL(15, 2) GENERATED ALWAYS AS (
    bank_balance + debt_mutual_funds + endowment_plans + fixed_deposits + 
    nps + epf + ppf + structured_products_debt + gold_etfs_funds
  ) STORED,
  
  -- Total Assets (calculated directly from all fields to avoid generated column dependency)
  total_assets DECIMAL(15, 2) GENERATED ALWAYS AS (
    direct_equity + esops + equity_pms + ulip + real_estate + 
    real_estate_funds + private_equity + equity_mutual_funds + 
    structured_products_equity +
    bank_balance + debt_mutual_funds + endowment_plans + fixed_deposits + 
    nps + epf + ppf + structured_products_debt + gold_etfs_funds
  ) STORED,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_financial_entries_profile_date 
  ON financial_entries(profile_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_user_profile_links_user 
  ON user_profile_links(user_id);

CREATE INDEX IF NOT EXISTS idx_user_profile_links_profile 
  ON user_profile_links(profile_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role 
  ON user_profiles(role);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user is admin
-- SECURITY DEFINER bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has edit permission for profile
-- SECURITY DEFINER bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.has_edit_permission(user_id UUID, profile_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profile_links
    WHERE user_profile_links.user_id = has_edit_permission.user_id
      AND user_profile_links.profile_id = has_edit_permission.profile_id
      AND permission = 'edit'
  ) OR public.is_admin(user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user_profiles entry when user signs up
-- This bypasses RLS using SECURITY DEFINER and ensures every auth.users entry has a corresponding user_profiles entry
-- Based on working reference implementation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count existing users in user_profiles
  -- This determines if the new user is the first user
  SELECT COUNT(*) INTO user_count FROM public.user_profiles;
  
  -- Insert new user profile
  -- First user (count = 0) becomes admin automatically
  -- All subsequent users start as pending and require admin approval
  INSERT INTO public.user_profiles (id, email, role, approved_at)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN user_count = 0 THEN 'admin' ELSE 'pending' END,
    CASE WHEN user_count = 0 THEN NOW() ELSE NULL END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table to auto-create user_profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_entries_updated_at ON financial_entries;
CREATE TRIGGER update_financial_entries_updated_at
  BEFORE UPDATE ON financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USER_PROFILES POLICIES
-- ============================================================================

-- Policy: Users can view their own profile
-- This allows users to see their own role and approval status
CREATE POLICY "Users can view their own profile."
ON user_profiles FOR SELECT
USING (auth.uid() = id);

-- Policy: Admins can view all profiles
-- Uses SECURITY DEFINER function to avoid infinite recursion
CREATE POLICY "Admins can view all profiles."
ON user_profiles FOR SELECT
USING (public.is_admin(auth.uid()));

-- Only admins can update user profiles
CREATE POLICY "Admins update profiles" ON user_profiles
  FOR UPDATE 
  USING (is_admin(auth.uid()));

-- Users can insert their own profile (for signup)
CREATE POLICY "Users insert own profile" ON user_profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

-- Users can view profiles they're linked to, admins can view all
CREATE POLICY "Users view linked profiles" ON profiles
  FOR SELECT 
  USING (
    is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM user_profile_links
      WHERE user_id = auth.uid() AND profile_id = profiles.id
    )
  );

-- Admins and approved users can create profiles
CREATE POLICY "Approved users create profiles" ON profiles
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'approved')
    )
  );

-- Admins can update profiles
CREATE POLICY "Admins update profiles" ON profiles
  FOR UPDATE 
  USING (is_admin(auth.uid()));

-- Admins can delete profiles
CREATE POLICY "Admins delete profiles" ON profiles
  FOR DELETE 
  USING (is_admin(auth.uid()));

-- ============================================================================
-- USER_PROFILE_LINKS POLICIES
-- ============================================================================

-- Users can view their own links, admins can view all
CREATE POLICY "Users view own links" ON user_profile_links
  FOR SELECT 
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- Only admins can manage links
CREATE POLICY "Admins manage links" ON user_profile_links
  FOR ALL 
  USING (is_admin(auth.uid()));

-- ============================================================================
-- FINANCIAL_ENTRIES POLICIES
-- ============================================================================

-- Users can view entries for linked profiles
CREATE POLICY "Users view linked entries" ON financial_entries
  FOR SELECT 
  USING (
    is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM user_profile_links
      WHERE user_id = auth.uid() AND profile_id = financial_entries.profile_id
    )
  );

-- Users with edit permission can insert entries
CREATE POLICY "Users insert entries" ON financial_entries
  FOR INSERT 
  WITH CHECK (
    is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM user_profile_links
      WHERE user_id = auth.uid() 
        AND profile_id = financial_entries.profile_id
        AND permission = 'edit'
    )
  );

-- Users with edit permission can update entries
CREATE POLICY "Users update entries" ON financial_entries
  FOR UPDATE 
  USING (
    is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM user_profile_links
      WHERE user_id = auth.uid() 
        AND profile_id = financial_entries.profile_id
        AND permission = 'edit'
    )
  );

-- Users with edit permission can delete entries
CREATE POLICY "Users delete entries" ON financial_entries
  FOR DELETE 
  USING (
    is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM user_profile_links
      WHERE user_id = auth.uid() 
        AND profile_id = financial_entries.profile_id
        AND permission = 'edit'
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_profiles IS 'Extends auth.users with role and approval status';
COMMENT ON TABLE profiles IS 'Financial profiles that can exist independently';
COMMENT ON TABLE user_profile_links IS 'Many-to-many relationship between users and profiles with permissions';
COMMENT ON TABLE financial_entries IS 'Timestamped financial data entries for profiles';

COMMENT ON FUNCTION is_admin(UUID) IS 'Check if a user has admin role';
COMMENT ON FUNCTION has_edit_permission(UUID, UUID) IS 'Check if a user has edit permission for a profile';
COMMENT ON FUNCTION handle_new_user() IS 'Automatically create user_profiles entry when user signs up in auth.users';
