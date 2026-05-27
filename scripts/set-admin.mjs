import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://izwsssbuuikxyiorrwnz.supabase.co';
const SERVICE_ROLE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6d3Nzc2J1dWlreHlpb3Jyd256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTE4NzE5NCwiZXhwIjoyMDk0NzYzMTk0fQ.hhkSS1rRcg2fuKWKkXkgKMmvs-9jSPacWkgAvFAfooY';
const ADMIN_EMAIL       = 'admin@furnicute.com';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log(`\n🔧 Looking up user: ${ADMIN_EMAIL}...`);

  // Step 1: Get the user's UUID from auth.users via Admin API
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('❌ Failed to list users:', listErr.message);
    process.exit(1);
  }

  const authUser = listData.users.find(u => u.email === ADMIN_EMAIL);
  if (!authUser) {
    console.error(`❌ No Supabase auth user found with email: ${ADMIN_EMAIL}`);
    console.log('\n📋 All existing auth users:');
    listData.users.forEach(u => console.log(`   • ${u.email} (${u.id})`));
    process.exit(1);
  }

  console.log(`✅ Found auth user: ${authUser.email} → ID: ${authUser.id}`);

  // Step 2: Check if profile exists
  const { data: existing, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, role, username')
    .eq('id', authUser.id)
    .single();

  if (fetchErr && fetchErr.code !== 'PGRST116') {
    console.error('❌ Error fetching profile:', fetchErr.message);
    process.exit(1);
  }

  if (!existing) {
    // Create profile if missing
    console.log('⚠️  Profile not found — creating one with role=admin...');
    const { error: insertErr } = await supabase.from('profiles').insert({
      id: authUser.id,
      username: 'Administrator',
      role: 'admin',
      address: '',
      mobile: '',
    });
    if (insertErr) {
      console.error('❌ Failed to create profile:', insertErr.message);
      process.exit(1);
    }
    console.log('✅ Profile created with role=admin');
  } else {
    console.log(`📋 Current profile role: "${existing.role}"`);

    if (existing.role === 'admin') {
      console.log('✅ Role is already "admin" — no update needed.');
    } else {
      // Update role to admin
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', authUser.id);

      if (updateErr) {
        console.error('❌ Failed to update role:', updateErr.message);
        process.exit(1);
      }
      console.log('✅ Role updated from "user" → "admin"');
    }
  }

  // Step 3: Verify
  const { data: verified } = await supabase
    .from('profiles')
    .select('id, role, username')
    .eq('id', authUser.id)
    .single();

  console.log('\n🎉 Verification:');
  console.log(`   Email    : ${ADMIN_EMAIL}`);
  console.log(`   Role     : ${verified?.role}`);
  console.log(`   Username : ${verified?.username}`);
  console.log('\n✅ Done! You can now log in at http://localhost:8081/login');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
