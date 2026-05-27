import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://izwsssbuuikxyiorrwnz.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6d3Nzc2J1dWlreHlpb3Jyd256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTE4NzE5NCwiZXhwIjoyMDk0NzYzMTk0fQ.hhkSS1rRcg2fuKWKkXkgKMmvs-9jSPacWkgAvFAfooY';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('Testing SELECT * from furniture (SERVICE ROLE)...');
  const { data: furn, error: furnErr } = await admin.from('furniture').select('*');
  console.log('Furniture count (admin):', furn?.length ?? 0, 'Error:', furnErr?.message);
  
  if (furn) {
    console.log('Furniture sample:', furn.slice(0, 2));
  }
}

main().catch(console.error);
