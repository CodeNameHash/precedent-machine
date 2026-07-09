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

  const { data: cards, error } = await supabase
    .from('provision_cards')
    .select('*')
    .eq('deal_id', DEAL_ID);
  if (error) { console.error('CARDS ERROR', error); process.exit(1); }
  console.log(`Total provision_cards for deal: ${cards.length}`);

  const nosolCards = cards.filter((c) => {
    const code = String(c.provision_subtype || c.canonical_code || c.provision_code || '').toUpperCase();
    const type = String(c.provision_type || '').toUpperCase();
    return /^NOSOL/.test(code) || type === 'COVENANT_NO_SOLICITATION' || type === 'DEFINITION' && /superior|takeover|intervening|confidentiality|acquisition proposal|qualifying/i.test(String(c.defined_term || ''));
  });
  console.log(`Relevant no-sol/definition cards: ${nosolCards.length}`);
  console.log(JSON.stringify(nosolCards.map(c => ({
    id: c.id, provision_type: c.provision_type, provision_subtype: c.provision_subtype,
    canonical_code: c.canonical_code, provision_code: c.provision_code,
    short_title: c.short_title, defined_term: c.defined_term, party_scope: c.party_scope,
  })), null, 2));

  const cardIds = cards.map((c) => c.id);
  const { data: claims, error: claimsErr } = await supabase
    .from('claims')
    .select('*')
    .in('provision_card_id', cardIds);
  if (claimsErr) { console.error('CLAIMS ERROR', claimsErr); process.exit(1); }
  console.log(`Total claims for these cards: ${claims.length}`);

  fs.writeFileSync(path.join(__dirname, '_tmp_new_cards.json'), JSON.stringify(cards, null, 2));
  fs.writeFileSync(path.join(__dirname, '_tmp_new_claims.json'), JSON.stringify(claims, null, 2));
  console.log('wrote _tmp_new_cards.json and _tmp_new_claims.json');
}
main();
