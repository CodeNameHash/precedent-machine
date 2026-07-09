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
  const { data, error } = await supabase.from('provisions').select('*').eq('deal_id', DEAL_ID);
  if (error) { console.error(error); process.exit(1); }
  const keys = ['forceTheVote', 'forceTheVoteDetails', 'parentTerminationRightForNonsolicitBreach', 'goShop', 'standstillWaiverPermitted', 'antiClubbingWaiverPermitted', 'dontAskDontWaive'];
  for (const p of data) {
    let meta = p.ai_metadata;
    if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = null; } }
    const features = (meta && meta.features) || {};
    const json = JSON.stringify(features);
    for (const k of keys) {
      if (json.includes(k)) {
        console.log(`FOUND "${k}" in provision id=${p.id} type=${p.type} code=${meta && meta.code}`);
      }
    }
  }
  console.log('done, total scanned:', data.length);
}
main();
