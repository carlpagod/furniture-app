-- ============================================================
-- FurniCute — Grant Admin Role to Your Account
-- Run this in: https://izwsssbuuikxyiorrwnz.supabase.co
--   → SQL Editor → New query → paste → Run
-- ============================================================

-- STEP 1: Check what users exist in auth.users
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC;

-- ─────────────────────────────────────────────────────────────
-- STEP 2: Promote a specific email to admin
-- Replace 'your-admin@email.com' with the actual admin email
-- ─────────────────────────────────────────────────────────────
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'your-admin@email.com'  -- ← CHANGE THIS
  LIMIT 1
);

-- Verify the update worked
SELECT p.id, u.email, p.username, p.role
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.role DESC, u.email;

-- ─────────────────────────────────────────────────────────────
-- STEP 3 (optional): Ensure all other accounts stay as 'user'
-- ─────────────────────────────────────────────────────────────
-- UPDATE public.profiles
-- SET role = 'user'
-- WHERE id != (SELECT id FROM auth.users WHERE email = 'your-admin@email.com' LIMIT 1);

-- ─────────────────────────────────────────────────────────────
-- HOW THIS WORKS:
--
--  • When your admin email signs in via the WEB build of the app,
--    auth.js fetches the profile from Supabase → sees role='admin'
--    → routes to /(admin)/dashboard.
--
--  • If the same email tries to log in on mobile, the app blocks
--    it with: "Admin accounts can only be accessed from the Web Admin Portal."
--
--  • If a regular user (role='user') tries to log in on the web,
--    the app blocks it with: "This portal is for Admin accounts only."
--
--  • Users registered through the mobile signup form are always
--    assigned role='user' — they can NEVER become admin via the app.
-- ─────────────────────────────────────────────────────────────
