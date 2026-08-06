import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const fixturePath = path.join(root, 'tests/fixtures/canonical-v2/m3-v31-fixtures/corpus-cards.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Supabase environment is required');
for (const record of fixture.cards) {
  const request = new URL('/rest/v1/provision_cards', url);
  request.searchParams.set('select', 'id,deal_id,provision_type,provision_subtype,region_full_text');
  request.searchParams.set('id', `eq.${record.id}`);
  const response = await fetch(request, { headers: { apikey: key, authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`${record.id}: ${response.status} ${await response.text()}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`${record.id}: expected one production row`);
  const data = rows[0];
  const digest = crypto.createHash('sha256').update(data.region_full_text).digest('hex');
  for (const field of ['deal_id', 'provision_type', 'provision_subtype']) {
    if (data[field] !== record[field]) throw new Error(`${record.id}: ${field} changed`);
  }
  if (digest !== record.region_full_text_sha256) throw new Error(`${record.id}: region_full_text digest changed`);
  if (!data.region_full_text.includes(record.source_excerpt)) throw new Error(`${record.id}: source excerpt no longer occurs in region_full_text`);
  process.stdout.write(`${record.id}: verified\n`);
}
