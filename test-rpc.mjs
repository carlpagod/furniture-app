import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://izwsssbuuikxyiorrwnz.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6d3Nzc2J1dWlreHlpb3Jyd256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTE4NzE5NCwiZXhwIjoyMDk0NzYzMTk0fQ.hhkSS1rRcg2fuKWKkXkgKMmvs-9jSPacWkgAvFAfooY';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('Testing RPC exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text DEFAULT \'\';'
  });
  if (error) {
    console.error('exec_sql RPC failed:', error.message);
  } else {
    console.log('exec_sql RPC succeeded:', data);
  }
}

main().catch(console.error);
