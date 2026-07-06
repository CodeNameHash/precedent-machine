const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const { FEATURES } = require('../../lib/schema');

function loadEnvLocal() {
  const file = path.join(__dirname, '..', '..', '.env.local');
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    if (process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

async function fetchProvisionFeatureKeys(sb) {
  const keys = new Map();
  const pageSize = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await sb
      .from('provisions')
      .select('id, ai_metadata')
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);

    for (const row of data || []) {
      const features = row.ai_metadata && row.ai_metadata.features;
      if (!features || typeof features !== 'object' || Array.isArray(features)) continue;
      for (const key of Object.keys(features)) {
        keys.set(key, (keys.get(key) || 0) + 1);
      }
    }

    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }

  return keys;
}

test('every live provision feature key is in the schema registry', async (t) => {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    t.skip('no Supabase service env');
    return;
  }

  const sb = createClient(url, key);
  const liveKeys = await fetchProvisionFeatureKeys(sb);
  const registryKeys = new Set(Object.keys(FEATURES));
  const missing = [...liveKeys.entries()]
    .filter(([featureKey]) => !registryKeys.has(featureKey))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  assert.deepEqual(missing, [], `Live keys missing from registry: ${JSON.stringify(missing.slice(0, 50))}`);
});
