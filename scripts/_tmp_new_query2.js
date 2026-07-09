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
  const { data: cards, error } = await supabase.from('provision_cards').select('*').eq('deal_id', DEAL_ID);
  if (error) { console.error('CARDS ERROR', error); process.exit(1); }

  const nosolCards = cards.filter((c) => {
    const code = String(c.provision_subtype || c.canonical_code || c.provision_code || '').toUpperCase();
    const type = String(c.provision_type || '').toUpperCase();
    return /^NOSOL/.test(code) || type === 'COVENANT_NO_SOLICITATION' || (type === 'DEFINITION' && /superior|takeover|intervening|confidentiality|acquisition proposal|qualifying/i.test(String(c.defined_term || '')));
  });

  const { data: claims, error: claimsErr } = await supabase
    .from('claims')
    .select('*')
    .eq('deal_id', DEAL_ID);
  if (claimsErr) { console.error('CLAIMS ERROR', claimsErr); process.exit(1); }
  console.log(`Total claims for deal: ${claims.length}`);

  const claimsByInstance = new Map();
  for (const cl of claims) {
    const key = cl.provision_instance_id;
    if (!claimsByInstance.has(key)) claimsByInstance.set(key, []);
    claimsByInstance.get(key).push(cl);
  }

  for (const c of nosolCards) {
    const myClaims = claimsByInstance.get(c.provision_instance_id) || [];
    console.log(`\n=== CARD id=${c.id} type=${c.provision_type} subtype=${c.provision_subtype} short_title="${c.short_title}" defined_term="${c.defined_term}" party_scope=${c.party_scope}`);
    console.log(`   defined_value: ${c.defined_value ? JSON.stringify(c.defined_value).slice(0,200) : null}`);
    console.log(`   claims (${myClaims.length}):`);
    for (const cl of myClaims) {
      console.log(`     - attribute="${cl.attribute}" canonical=${JSON.stringify(cl.canonical)} verbatim="${String(cl.verbatim||'').slice(0,150)}"`);
    }
  }
}
main();
