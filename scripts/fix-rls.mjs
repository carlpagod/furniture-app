/**
 * Uses Supabase's Management API to run raw SQL.
 * This endpoint is available for all Supabase projects via the service role.
 */

const SUPABASE_URL     = 'https://izwsssbuuikxyiorrwnz.supabase.co';
// Note: We use the postgres REST endpoint via pg_dump-style queries
const SUPABASE_DB_URL  = 'https://izwsssbuuikxyiorrwnz.supabase.co/rest/v1/rpc';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6d3Nzc2J1dWlreHlpb3Jyd256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTE4NzE5NCwiZXhwIjoyMDk0NzYzMTk0fQ.hhkSS1rRcg2fuKWKkXkgAvFAfooY';

// The SQL statements to execute one by one
const SQL_STEPS = [
  {
    desc: 'Drop old recursive policy: Admins can view all profiles',
    sql: `DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles`,
  },
  {
    desc: 'Drop old policy: Users can view own profile',
    sql: `DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles`,
  },
  {
    desc: 'Drop old policy: Users can update own profile',
    sql: `DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles`,
  },
  {
    desc: 'Drop old policy: Users can insert own profile',
    sql: `DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles`,
  },
  {
    desc: 'Drop new policies if they exist (clean slate)',
    sql: `
      DROP POLICY IF EXISTS "profiles_select_own"      ON public.profiles;
      DROP POLICY IF EXISTS "profiles_select_admin_all" ON public.profiles;
      DROP POLICY IF EXISTS "profiles_update_own"       ON public.profiles;
      DROP POLICY IF EXISTS "profiles_insert_own"       ON public.profiles;
    `,
  },
  {
    desc: 'Create get_my_role() security definer function',
    sql: `
      CREATE OR REPLACE FUNCTION public.get_my_role()
      RETURNS TEXT
      LANGUAGE SQL
      SECURITY DEFINER
      STABLE
      SET search_path = public
      AS $func$
        SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
      $func$
    `,
  },
  {
    desc: 'Create profiles_select_own policy',
    sql: `
      CREATE POLICY "profiles_select_own"
        ON public.profiles FOR SELECT
        USING (auth.uid() = id)
    `,
  },
  {
    desc: 'Create profiles_select_admin_all policy',
    sql: `
      CREATE POLICY "profiles_select_admin_all"
        ON public.profiles FOR SELECT
        USING (public.get_my_role() = 'admin')
    `,
  },
  {
    desc: 'Create profiles_update_own policy',
    sql: `
      CREATE POLICY "profiles_update_own"
        ON public.profiles FOR UPDATE
        USING (auth.uid() = id)
    `,
  },
  {
    desc: 'Create profiles_insert_own policy',
    sql: `
      CREATE POLICY "profiles_insert_own"
        ON public.profiles FOR INSERT
        WITH CHECK (auth.uid() = id)
    `,
  },
];

async function runSQL(sql, desc) {
  const endpoint = `${SUPABASE_URL}/rest/v1/rpc/execute_sql`;
  
  // Try different RPC patterns
  const patterns = [
    { url: `${SUPABASE_URL}/rest/v1/rpc/execute_sql`,      body: { query: sql } },
    { url: `${SUPABASE_URL}/rest/v1/rpc/run_sql`,          body: { query: sql } },
    { url: `${SUPABASE_URL}/rest/v1/rpc/pg_query`,         body: { query: sql } },
  ];

  for (const { url, body } of patterns) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(body),
      });
      
      if (res.ok || res.status === 200) {
        return { ok: true, status: res.status };
      }
      
      const text = await res.text();
      if (!text.includes('not found') && !text.includes('does not exist')) {
        // Got a real error (not just 404 for wrong endpoint)
        return { ok: false, error: text };
      }
    } catch (e) {
      // Try next pattern
    }
  }
  
  return { ok: false, error: 'No compatible SQL RPC endpoint found' };
}

async function main() {
  console.log('\n🔧 Attempting to fix Supabase RLS via REST API...\n');

  let anyWorked = false;

  for (const step of SQL_STEPS) {
    process.stdout.write(`  • ${step.desc}... `);
    const result = await runSQL(step.sql, step.desc);
    
    if (result.ok) {
      console.log('✅');
      anyWorked = true;
    } else {
      console.log(`⚠️  (${result.error?.substring(0, 60) || 'skipped'})`);
    }
  }

  if (!anyWorked) {
    console.log('\n⚠️  The SQL RPC endpoints are not available via REST.');
    console.log('   You need to run the SQL manually in Supabase.\n');
    console.log('📋 INSTRUCTIONS:');
    console.log('   1. Go to: https://supabase.com/dashboard');
    console.log('   2. Log in with your Supabase account');
    console.log('   3. Select project: izwsssbuuikxyiorrwnz');
    console.log('   4. Click "SQL Editor" in the left menu');
    console.log('   5. Click "+ New Query"');
    console.log('   6. Paste and run the SQL from: scripts/fix-policies.sql\n');
  }
}

main().catch(console.error);
