import fs from 'node:fs';
import path from 'node:path';
import { useMemo, useState } from 'react';
import AdminNav from '../../components/admin/AdminNav';
import { getServiceSupabase } from '../../lib/supabase';

const DOC_PATH = path.join(process.cwd(), 'docs/schema-shape/provision-taxonomy-triple-model.md');

export const NODE_TYPES = [
  'Deal',
  'DealProfile',
  'Section',
  'Provision',
  'Excerpt',
  'Claim',
  'Attribute',
  'Verbatim',
  'Canonical',
  'Provenance',
  'Normalizer',
];

function compact(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 160);
  return String(value).slice(0, 160);
}

function featureBag(meta) {
  if (!meta || typeof meta !== 'object') return {};
  if (meta.features && typeof meta.features === 'object') return meta.features;
  return meta;
}

export function flattenFeatures(value, prefix = '', out = []) {
  if (value === null || value === undefined || value === '') return out;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => flattenFeatures(entry, `${prefix}[${index}]`, out));
    return out;
  }
  if (typeof value === 'object' && !('value' in value && Object.keys(value).length <= 3)) {
    for (const [key, entry] of Object.entries(value)) {
      flattenFeatures(entry, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.push({ attribute: prefix || 'value', value });
  return out;
}

function canonicalValue(value) {
  if (value && typeof value === 'object') {
    if ('code' in value) return value.code;
    if ('canonical' in value) return value.canonical;
    if ('value' in value && typeof value.value !== 'object') return value.value;
  }
  return value;
}

function uniqueRows(rows, key) {
  const seen = new Set();
  return rows.filter((row) => {
    const value = key(row);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

async function countRows(sb, table) {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

async function selectRows(sb, table, select, limit = 500) {
  const { data, error } = await sb.from(table).select(select).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function loadTaxonomyLiveData(sb) {
  const empty = NODE_TYPES.map((node) => ({ node, count: 0, rows: [], source: 'offline' }));
  if (!sb) return { status: 'offline', nodes: empty };

  try {
    const [dealCount, provisionCount, deals, provisions] = await Promise.all([
      countRows(sb, 'deals'),
      countRows(sb, 'provisions'),
      selectRows(sb, 'deals', 'id, acquirer, target, announce_date, sector, metadata', 100),
      selectRows(sb, 'provisions', 'id, deal_id, type, category, full_text, ai_metadata, created_at', 1000),
    ]);

    const sections = uniqueRows(provisions, (row) => `${row.deal_id}:${row.type || ''}:${row.category || ''}`)
      .map((row) => ({ id: `${row.deal_id}:${row.type || ''}:${row.category || ''}`, label: row.category || row.type || 'Section', detail: row.deal_id }));
    const claims = [];
    const attributes = new Map();
    const verbatims = [];
    const canonicals = [];
    const provenances = [];
    const normalizers = new Set();

    for (const provision of provisions) {
      const features = flattenFeatures(featureBag(provision.ai_metadata));
      if (provision.ai_metadata) {
        provenances.push({ id: provision.id, label: provision.category || provision.type || 'Provision', detail: 'ai_metadata present' });
      }
      for (const feature of features) {
        const id = `${provision.id}:${feature.attribute}`;
        const value = compact(feature.value);
        claims.push({ id, label: feature.attribute, detail: value || provision.id });
        attributes.set(feature.attribute, { id: feature.attribute, label: feature.attribute, detail: provision.type || 'Provision' });
        if (value) verbatims.push({ id, label: feature.attribute, detail: value });
        const canonical = compact(canonicalValue(feature.value));
        if (canonical) canonicals.push({ id, label: feature.attribute, detail: canonical });
        if (feature.value && typeof feature.value === 'object') normalizers.add(feature.attribute);
      }
    }

    const nodes = [
      { node: 'Deal', count: dealCount, rows: deals.map((deal) => ({ id: deal.id, label: [deal.acquirer, deal.target].filter(Boolean).join(' / ') || deal.id, detail: deal.announce_date || deal.sector || '' })), source: 'Supabase: deals' },
      { node: 'DealProfile', count: dealCount, rows: deals.map((deal) => ({ id: deal.id, label: [deal.acquirer, deal.target].filter(Boolean).join(' / ') || deal.id, detail: compact(deal.metadata) || 'metadata' })), source: 'Supabase: deals.metadata' },
      { node: 'Section', count: sections.length, rows: sections, source: 'Supabase: provisions grouped by deal/type/category' },
      { node: 'Provision', count: provisionCount, rows: provisions.map((provision) => ({ id: provision.id, label: provision.category || provision.type || 'Provision', detail: provision.deal_id })), source: 'Supabase: provisions' },
      { node: 'Excerpt', count: provisions.filter((provision) => provision.full_text).length, rows: provisions.filter((provision) => provision.full_text).map((provision) => ({ id: provision.id, label: provision.category || provision.type || 'Excerpt', detail: compact(provision.full_text) })), source: 'Supabase: provisions.full_text' },
      { node: 'Claim', count: claims.length, rows: claims, source: 'Supabase: provisions.ai_metadata' },
      { node: 'Attribute', count: attributes.size, rows: [...attributes.values()], source: 'Supabase: feature keys' },
      { node: 'Verbatim', count: verbatims.length, rows: verbatims, source: 'Supabase: feature values' },
      { node: 'Canonical', count: canonicals.length, rows: canonicals, source: 'Supabase: canonical-like feature values' },
      { node: 'Provenance', count: provenances.length, rows: provenances, source: 'Supabase: ai_metadata presence' },
      { node: 'Normalizer', count: normalizers.size, rows: [...normalizers].map((key) => ({ id: key, label: key, detail: 'object-valued feature resolved through registry/vocab rules' })), source: 'Supabase: object-valued feature keys' },
    ];
    return { status: 'live', nodes };
  } catch (error) {
    return { status: `error: ${error.message}`, nodes: empty };
  }
}

function markdownBlocks(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const blocks = [];
  let code = null;
  let paragraph = [];
  function flushParagraph() {
    if (paragraph.length) blocks.push({ type: 'p', text: paragraph.join(' ') });
    paragraph = [];
  }
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (code) {
        blocks.push({ type: 'code', lang: code.lang, text: code.lines.join('\n') });
        code = null;
      } else {
        flushParagraph();
        code = { lang: line.replace(/^```/, '').trim(), lines: [] };
      }
      continue;
    }
    if (code) {
      code.lines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ type: `h${heading[1].length}`, text: heading[2] });
      continue;
    }
    if (line.startsWith('- ')) {
      flushParagraph();
      blocks.push({ type: 'li', text: line.slice(2) });
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  return blocks;
}

function MarkdownPanel({ markdown }) {
  return (
    <div className="space-y-3 rounded border border-border bg-white p-5">
      {markdownBlocks(markdown).map((block, index) => {
        if (block.type === 'h1') return <h1 key={index} className="font-display text-2xl text-ink">{block.text.replace(/\*\*/g, '')}</h1>;
        if (block.type === 'h2') return <h2 key={index} className="pt-3 font-display text-lg text-ink">{block.text.replace(/\*\*/g, '')}</h2>;
        if (block.type === 'h3') return <h3 key={index} className="pt-2 font-ui text-sm font-semibold text-ink">{block.text.replace(/\*\*/g, '')}</h3>;
        if (block.type === 'li') return <p key={index} className="pl-4 text-sm leading-6 text-inkLight">- {block.text.replace(/\*\*/g, '')}</p>;
        if (block.type === 'code') return <pre key={index} className="overflow-auto rounded border border-border bg-bg p-4 text-xs text-inkLight">{block.text}</pre>;
        return <p key={index} className="text-sm leading-6 text-inkLight">{block.text.replace(/\*\*/g, '')}</p>;
      })}
    </div>
  );
}

function RowsTable({ rows }) {
  const visible = (rows || []).slice(0, 25);
  if (!visible.length) return <p className="rounded border border-border bg-white p-4 text-sm text-inkLight">No rows available in this environment.</p>;
  return (
    <div className="overflow-auto rounded border border-border bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-bg text-xs uppercase text-inkFaint">
          <tr><th className="p-3">ID</th><th className="p-3">Label</th><th className="p-3">Detail</th></tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="max-w-[220px] truncate p-3 font-mono text-xs text-inkLight">{row.id}</td>
              <td className="p-3 text-ink">{row.label}</td>
              <td className="p-3 text-inkLight">{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

TaxonomyPage.noLayout = true;

export default function TaxonomyPage({ markdown, liveData }) {
  const nodes = liveData?.nodes || [];
  const [selected, setSelected] = useState(nodes[0]?.node || 'Deal');
  const active = useMemo(() => nodes.find((node) => node.node === selected) || nodes[0], [nodes, selected]);

  return (
    <div className="min-h-screen bg-bg p-6">
      <AdminNav className="mb-6" />
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">Taxonomy</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-inkLight">
          Read-only view of the provision taxonomy source and live corpus counts for each node type.
        </p>
      </header>
      <main className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <MarkdownPanel markdown={markdown} />
        <aside className="space-y-4">
          <div className="rounded border border-border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">Live node counts</h2>
              <span className="rounded border border-border px-2 py-1 text-xs text-inkLight">{liveData?.status || 'unknown'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2" data-testid="taxonomy-node-counts">
              {nodes.map((node) => (
                <button
                  key={node.node}
                  type="button"
                  onClick={() => setSelected(node.node)}
                  className={`rounded border p-3 text-left ${selected === node.node ? 'border-accent bg-accent text-white' : 'border-border bg-bg text-ink hover:border-accent'}`}
                >
                  <span className="block text-xs uppercase">{node.node}</span>
                  <strong className="mt-1 block text-xl">{node.count}</strong>
                </button>
              ))}
            </div>
          </div>
          {active ? (
            <section className="space-y-3">
              <div>
                <h2 className="font-display text-lg text-ink">{active.node}</h2>
                <p className="text-xs text-inkLight">{active.source}</p>
              </div>
              <RowsTable rows={active.rows} />
            </section>
          ) : null}
        </aside>
      </main>
    </div>
  );
}

export async function getServerSideProps() {
  const markdown = fs.readFileSync(DOC_PATH, 'utf8');
  const liveData = await loadTaxonomyLiveData(getServiceSupabase());
  return { props: { markdown, liveData } };
}
