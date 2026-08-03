import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(import.meta.dirname, '..');
const FAMILIES = Object.freeze([
  ['employee-matters-live-run', 'docs/superpowers/specs/2026-08-03-family-employee-matters-design.md'],
  ['dno-live-run', 'docs/superpowers/specs/2026-08-03-family-dno-indemnification-design.md'],
  ['financing-covenants-live-run', 'docs/superpowers/specs/2026-08-02-family-financing-covenants-design.md'],
  ['guaranty-live-run', 'docs/superpowers/specs/2026-08-03-family-guaranty-financing-party-design.md'],
]);
const PREFIX_DISPOSITIONS = Object.freeze({
  '13211d88': 'DEAL_ID_NOT_CARD_ID',
  bb5f062d: 'DEAL_ID_NOT_CARD_ID',
  df393645: 'DEAL_ID_NOT_CARD_ID',
  '1bdddd29': 'OPEN_WORLD_REFERENCE_OUTSIDE_ACCEPTANCE_FIXTURE_SET',
});

function requiredPrefixes(specPath) {
  const source = fs.readFileSync(path.join(ROOT, specPath), 'utf8');
  const acceptance = source.slice(source.indexOf('## 6. Acceptance tests'));
  return [...new Set([...acceptance.matchAll(/`([0-9a-f]{8})(?=…|[0-9a-f-]|`)/g)]
    .filter((match) => !/deal\s*$/i.test(acceptance.slice(Math.max(0, match.index - 12), match.index)))
    .map((match) => match[1]))].sort();
}

async function fetchCards(client) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from('provision_cards')
      .select('id,deal_id,provision_type,provision_subtype,region_full_text')
      .range(from, from + 999)
      .order('id');
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

function buildFixture({ family, specPath, prefixes, cards, retrievalDate }) {
  const missing_prefixes = [];
  const resolved_prefix_dispositions = {};
  const matches = prefixes.flatMap((prefix) => {
    if (PREFIX_DISPOSITIONS[prefix]) {
      resolved_prefix_dispositions[prefix] = PREFIX_DISPOSITIONS[prefix];
      return [];
    }
    const found = cards.filter((card) => card.id.startsWith(prefix));
    if (found.length === 0) {
      missing_prefixes.push(prefix);
      return [];
    }
    if (found.length !== 1) throw new Error(`${family}: prefix ${prefix} matched ${found.length} cards`);
    const card = found[0];
    if (typeof card.region_full_text !== 'string' || card.region_full_text.length === 0) {
      throw new Error(`${family}: card ${card.id} has no region_full_text`);
    }
    return [card];
  });
  return {
    schema: 'CANONICAL_V2_FAMILY_CORPUS_FIXTURES/V1',
    family,
    source_spec: specPath,
    retrieval_date: retrievalDate,
    source_table: 'provision_cards',
    resolved_prefix_dispositions,
    missing_prefixes,
    cards: matches,
  };
}

async function main() {
  const check = process.argv.includes('--check');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase environment is required');
  const cards = await fetchCards(createClient(url, key, { auth: { persistSession: false } }));
  const retrievalDate = new Date().toISOString().slice(0, 10);
  for (const [family, specPath] of FAMILIES) {
    const fixture = buildFixture({
      family,
      specPath,
      prefixes: requiredPrefixes(specPath),
      cards,
      retrievalDate,
    });
    const output = `${JSON.stringify(fixture, null, 2)}\n`;
    const outputPath = path.join(ROOT, 'tests/fixtures/canonical-v2', family, 'corpus-cards.json');
    if (check) {
      const committed = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      fixture.retrieval_date = committed.retrieval_date;
      if (`${JSON.stringify(fixture, null, 2)}\n` !== fs.readFileSync(outputPath, 'utf8')) {
        throw new Error(`${family}: committed fixture does not match production`);
      }
    } else {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, output);
    }
    process.stdout.write(`${family}: ${fixture.cards.length} cards, ${fixture.missing_prefixes.length} missing prefixes\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
