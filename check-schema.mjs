import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://izwsssbuuikxyiorrwnz.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6d3Nzc2J1dWlreHlpb3Jyd256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTE4NzE5NCwiZXhwIjoyMDk0NzYzMTk0fQ.hhkSS1rRcg2fuKWKkXkgKMmvs-9jSPacWkgAvFAfooY';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('🔍 Querying remote database schema info...');
  
  // Query information_schema for columns in profiles table
  const { data: columns, error: colErr } = await supabase
    .rpc('get_table_columns', { table_name: 'profiles' });

  if (colErr) {
    console.error('RPC get_table_columns failed:', colErr.message);
    
    // Try running raw query or fetch profile select *
    const { data: selectAll, error: selErr } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (selErr) {
      console.error('Select * failed:', selErr.message);
    } else {
      console.log('Sample profiles row:', selectAll);
    }
  } else {
    console.log('Profiles columns:', columns);
  }
}

main().catch(console.error);
