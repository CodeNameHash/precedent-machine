const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    if (process.env[key]) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function serviceClient() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function metaObject(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function featuresOf(row) {
  return metaObject(metaObject(row && row.ai_metadata).features);
}

function normalizePhrase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9$%.'"\s-]+/g, ' ')
    .replace(/\bshares\b/g, 'share')
    .replace(/\bcontracts\b/g, 'contract')
    .replace(/\s+/g, ' ')
    .trim();
}

function phraseFromValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  return value.label || value.text || value.value || value.code || null;
}

function addPhrase(map, raw, context) {
  const phrase = phraseFromValue(raw);
  if (!phrase) return;
  const norm = normalizePhrase(phrase);
  if (!norm) return;
  if (!map.has(norm)) map.set(norm, { norm, samples: [], count: 0 });
  const entry = map.get(norm);
  entry.count += 1;
  if (entry.samples.length < 5) entry.samples.push({ phrase, context });
}

function canonicalProposal(norm) {
  return norm
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (['SEC', 'MAE', 'IOC', 'CVR', 'HSR', 'DGCL', 'IP'].includes(upper)) return upper;
      return word[0] ? word[0].toUpperCase() + word.slice(1) : word;
    })
    .join(' ');
}

async function fetchProvisions(types) {
  const sb = serviceClient();
  if (!sb) return { rows: [], note: 'Supabase env not configured.' };
  let query = sb
    .from('provisions')
    .select('id, deal_id, type, category, full_text, ai_metadata, deal:deals(acquirer,target,announce_date)')
    .order('created_at', { ascending: true });
  if (types && types.length) query = query.in('type', types);
  const { data, error } = await query;
  if (error) return { rows: [], note: error.message };
  return { rows: data || [], note: null };
}

function writeReport(file, title, entries, note) {
  const outPath = path.join(process.cwd(), file);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const lines = [`# ${title}`, '', `Generated: ${new Date().toISOString()}`, ''];
  if (note) lines.push(`Note: ${note}`, '');
  lines.push('| Normalized phrase | Count | Proposed canonical label | Samples | Reviewer |');
  lines.push('| --- | ---: | --- | --- | --- |');
  for (const entry of entries) {
    const samples = entry.samples
      .map((s) => `${String(s.phrase).replace(/\|/g, '\\|')} (${s.context})`)
      .join('<br>');
    lines.push(`| ${entry.norm.replace(/\|/g, '\\|')} | ${entry.count} | ${canonicalProposal(entry.norm).replace(/\|/g, '\\|')} | ${samples} | [ ] accept [ ] rename [ ] reject |`);
  }
  if (entries.length === 0) {
    lines.push('| _No phrases found_ | 0 |  |  | [ ] confirm |');
  }
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`);
  return outPath;
}

module.exports = {
  addPhrase,
  fetchProvisions,
  featuresOf,
  normalizePhrase,
  phraseFromValue,
  writeReport,
};
