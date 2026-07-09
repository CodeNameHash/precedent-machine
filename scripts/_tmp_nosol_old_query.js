const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const { createClient } = require('@supabase/supabase-js');

const DEAL_ID = '885edae5-49e8-464a-9f33-edd229119d7c';

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('provisions')
    .select('*')
    .eq('deal_id', DEAL_ID);

  if (error) {
    console.error('ERROR', error);
    process.exit(1);
  }

  console.log(`Total provisions for deal: ${data.length}`);

  const relevant = data.filter((p) => {
    const t = String(p.type || '').toUpperCase();
    const cat = String(p.category || '').toLowerCase();
    return /^NOSOL/.test(t) || t === 'DEF' || /solicit|superior|intervening|fiduciary|takeover|recommendation|acqui/i.test(cat);
  });

  console.log(`Relevant (NOSOL/DEF/keyword) provisions: ${relevant.length}`);
  console.log('=====');

  for (const p of relevant) {
    let meta = p.ai_metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { meta = null; }
    }
    const code = (meta && meta.code) || p.code || null;
    const features = (meta && meta.features) || {};
    console.log(`\n--- id=${p.id} type=${p.type} code=${code} category=${p.category} section=${p.section_number}`);
    console.log(`full_text (first 200 chars): ${String(p.full_text || '').slice(0, 200).replace(/\s+/g, ' ')}`);
    console.log('features:', JSON.stringify(features, null, 2));
  }
}

main();
