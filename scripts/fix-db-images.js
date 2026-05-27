const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-key';

// If env variables are not present, let's read from the local file
const fs = require('fs');
const path = require('path');

async function getCredentials() {
  try {
    const configPath = './lib/supabase.js';
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const urlMatch = content.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
      const keyMatch = content.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);
      return {
        url: urlMatch ? urlMatch[1] : null,
        key: keyMatch ? keyMatch[1] : null
      };
    }
  } catch (e) {
    console.error(e);
  }
  return {};
}

async function fixTableImages() {
  const creds = await getCredentials();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || creds.url;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || creds.key;

  if (!url || !key) {
    console.error('❌ Supabase credentials not found!');
    return;
  }

  const supabase = createClient(url, key);

  console.log('Fetching all furniture items from Supabase...');
  const { data, error } = await supabase.from('furniture').select('*');
  if (error) {
    console.error('❌ Error fetching furniture:', error);
    return;
  }

  console.log(`Found ${data.length} products in database.`);
  
  // Beautiful working Unsplash table image
  const workingTableImg = 'https://images.unsplash.com/photo-1577140917170-285929fb55b7?w=600&q=80';

  for (const item of data) {
    console.log(`Item ID: ${item.id}, Name: ${item.name}, Category: ${item.category}, Image: ${item.image_url}`);
    
    // If the category is Table/table and the image is null, empty, or has the old broken unsplash link, let's update it!
    const isTable = item.category && item.category.toLowerCase() === 'table';
    const isBroken = !item.image_url || item.image_url.includes('1549477531-69c28e5ac5ec');
    
    if (isTable && isBroken) {
      console.log(`Updating table product "${item.name}" with a beautiful working image...`);
      const { error: updateErr } = await supabase
        .from('furniture')
        .update({ image_url: workingTableImg })
        .eq('id', item.id);
        
      if (updateErr) {
        console.error(`❌ Failed to update item ${item.id}:`, updateErr);
      } else {
        console.log(`✅ Successfully updated item ${item.id}!`);
      }
    }
  }
}

fixTableImages().catch(console.error);
