import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://izwsssbuuikxyiorrwnz.supabase.co';
const ANON_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6d3Nzc2J1dWlreHlpb3Jyd256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxODcxOTQsImV4cCI6MjA5NDc2MzE5NH0.9C0YvvBvFgfF3JuyR5wfJrtJGTL8YYcF-geeD0H0VOk';

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('\n🔐 Signing in as admin@furnicute.com...');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@furnicute.com',
    password: 'Admin1234!',
  });

  if (error) {
    console.error('❌ Sign-in FAILED:', error.message);
    process.exit(1);
  }

  console.log('✅ Auth OK  — User ID:', data.user.id);

  // Try to read the profile
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, role, username')
    .eq('id', data.user.id)
    .single();

  if (profileErr) {
    console.error('❌ Profile READ failed:', profileErr.message);
    console.log('   The RLS fix did NOT work yet. Please re-run the SQL.');
  } else {
    console.log('✅ Profile READ succeeded!');
    console.log('   role    :', profile.role);
    console.log('   username:', profile.username);

    if (profile.role === 'admin') {
      console.log('\n🎉 Everything is working! You can now log in at http://localhost:8081/login');
    } else {
      console.log('\n⚠️  Role is "' + profile.role + '" — needs to be "admin".');
      console.log('   Run the set-admin.mjs script to fix this.');
    }
  }

  await supabase.auth.signOut();
}

main().catch(console.error);
