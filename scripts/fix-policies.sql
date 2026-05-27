
-- ============================================================
-- FurniCute — Fix Recursive RLS on profiles table
-- Run this in Supabase: SQL Editor > New Query > Paste > Run
-- URL: https://supabase.com/dashboard/project/izwsssbuuikxyiorrwnz/sql/new
-- ============================================================

-- STEP 1: Drop old potentially-recursive policies
DROP POLICY IF EXISTS "Admins can view all profiles"  ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"    ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own"           ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin_all"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"           ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"           ON public.profiles;

-- STEP 2: Create a SECURITY DEFINER function to avoid recursion
-- This runs as the database owner (bypasses RLS) to check the role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- STEP 3: Create clean, non-recursive RLS policies
-- Users can see their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can see ALL profiles (uses the safe function, not recursive query)
CREATE POLICY "profiles_select_admin_all"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'admin');

-- Users can update their own profile only
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (needed during signup)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- STEP 4: Verify the fix worked
SELECT u.email, p.role, p.username
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'admin@furnicute.com';

-- Expected result:
--   email                | role  | username
--   admin@furnicute.com  | admin | Administrator
