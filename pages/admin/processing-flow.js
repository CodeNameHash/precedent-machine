import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import AdminNav from '../../components/admin/AdminNav';
import { getServiceSupabase } from '../../lib/supabase';

const DOC_PATH = path.join(process.cwd(), 'docs/schema-shape/provision-processing-flow.md');
const GAPS_PATH = path.join(process.cwd(), 'docs/schema-shape/processing-flow-gaps.json');

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

function countFeatures(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (Array.isArray(value)) return value.reduce((sum, entry) => sum + countFeatures(entry), 0);
  if (typeof value === 'object' && !('value' in value && Object.keys(value).length <= 3)) {
    return Object.values(value).reduce((sum, entry) => sum + countFeatures(entry), 0);
  }
  return 1;
}

export function parseProcessingStages(markdown) {
  const stages = [];
  const rowPattern = /^\|\s*(\d+)\s*\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\|/gm;
  let match;
  while ((match = rowPattern.exec(markdown))) {
    stages.push({
      id: Number(match[1]),
      name: match[2].trim(),
      description: match[3].trim(),
    });
  }
  return stages;
}

async function countRows(sb, table) {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

async function selectRows(sb, table, select, limit = 1000) {
  const { data, error } = await sb.from(table).select(select).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function loadProcessingMetrics(sb, stages) {
  const offline = stages.map((stage) => ({
    ...stage,
    entering: 0,
    exiting: 0,
    failures: 0,
    source: 'offline',
  }));
  if (!sb) return { status: 'offline', metrics: offline };

  try {
    const [dealCount, provisionCount, provisions] = await Promise.all([
      countRows(sb, 'deals'),
      countRows(sb, 'provisions'),
      selectRows(sb, 'provisions', 'id, deal_id, type, category, full_text, ai_metadata, created_at', 1000),
    ]);
    const withText = provisions.filter((provision) => provision.full_text).length;
    const claims = provisions.reduce((sum, provision) => sum + countFeatures(featureBag(provision.ai_metadata)), 0);
    const withMetadata = provisions.filter((provision) => provision.ai_metadata).length;
    const byStage = {
      1: [dealCount, dealCount],
      2: [dealCount, provisionCount],
      3: [provisionCount, provisionCount],
      4: [provisionCount, claims],
      5: [claims, claims],
      6: [claims, withText],
      7: [withText, withMetadata],
      8: [withMetadata, dealCount],
    };
    return {
      status: 'live',
      metrics: stages.map((stage) => {
        const [entering, exiting] = byStage[stage.id] || [0, 0];
        return {
          ...stage,
          entering,
          exiting,
          failures: Math.max(0, entering - exiting),
          source: 'Supabase: deals/provisions sampled live',
        };
      }),
    };
  } catch (error) {
    return { status: `error: ${error.message}`, metrics: offline };
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
    if (line.startsWith('|')) {
      flushParagraph();
      blocks.push({ type: 'table-line', text: line });
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
        if (block.type === 'table-line') return <pre key={index} className="overflow-auto rounded bg-bg px-3 py-2 text-xs text-inkLight">{block.text}</pre>;
        if (block.type === 'code') return <pre key={index} className="overflow-auto rounded border border-border bg-bg p-4 text-xs text-inkLight">{block.text}</pre>;
        return <p key={index} className="text-sm leading-6 text-inkLight">{block.text.replace(/\*\*/g, '')}</p>;
      })}
    </div>
  );
}

function MetricsTable({ metrics }) {
  return (
    <div className="overflow-auto rounded border border-border bg-white" data-testid="processing-flow-metrics">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-bg text-xs uppercase text-inkFaint">
          <tr><th className="p-3">Stage</th><th className="p-3">Entering</th><th className="p-3">Exiting</th><th className="p-3">Delta</th></tr>
        </thead>
        <tbody>
          {metrics.map((stage) => (
            <tr key={stage.id} className="border-t border-border">
              <td className="p-3"><b>{stage.id}. {stage.name}</b><p className="mt-1 text-xs text-inkLight">{stage.description}</p></td>
              <td className="p-3 text-ink">{stage.entering}</td>
              <td className="p-3 text-ink">{stage.exiting}</td>
              <td className="p-3 text-inkLight">{stage.failures}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GapTable({ gaps }) {
  return (
    <div className="overflow-auto rounded border border-border bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-bg text-xs uppercase text-inkFaint">
          <tr><th className="p-3">Gap</th><th className="p-3">Issue</th><th className="p-3">Owner</th><th className="p-3">Status</th></tr>
        </thead>
        <tbody>
          {(gaps || []).map((gap) => (
            <tr key={gap.id} className="border-t border-border">
              <td className="p-3 font-mono text-xs text-inkLight">{gap.id}</td>
              <td className="p-3"><b className="text-ink">{gap.title}</b><p className="mt-1 text-xs leading-5 text-inkLight">{gap.problem}</p></td>
              <td className="p-3 text-inkLight">{gap.owning_wp}</td>
              <td className="p-3 text-inkLight">{gap.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

ProcessingFlowPage.noLayout = true;

export default function ProcessingFlowPage({ markdown, stages, metricsData, gaps }) {
  const metrics = metricsData?.metrics || [];
  return (
    <div className="min-h-screen bg-bg p-6">
      <AdminNav className="mb-6" />
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Processing flow</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-inkLight">
            Read-only view of the ingest-to-Claim flow, live stage metrics, and scheduled gap follow-ups.
          </p>
        </div>
        <Link href="/admin/taxonomy" className="rounded border border-border bg-white px-4 py-2 text-sm text-inkLight hover:border-accent hover:text-ink">
          Taxonomy
        </Link>
      </header>
      <main className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_500px]">
        <MarkdownPanel markdown={markdown} />
        <aside className="space-y-5">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">Stage metrics</h2>
              <span className="rounded border border-border bg-white px-2 py-1 text-xs text-inkLight">{metricsData?.status || 'unknown'}</span>
            </div>
            <MetricsTable metrics={metrics} />
          </section>
          <section className="space-y-3">
            <h2 className="font-display text-lg text-ink">Gap list</h2>
            <GapTable gaps={gaps} />
          </section>
        </aside>
      </main>
    </div>
  );
}

export async function getServerSideProps() {
  const markdown = fs.readFileSync(DOC_PATH, 'utf8');
  const stages = parseProcessingStages(markdown);
  const gaps = JSON.parse(fs.readFileSync(GAPS_PATH, 'utf8')).gaps || [];
  const metricsData = await loadProcessingMetrics(getServiceSupabase(), stages);
  return { props: { markdown, stages, metricsData, gaps } };
}
