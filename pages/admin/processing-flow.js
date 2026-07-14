import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import AdminNav from '../../components/admin/AdminNav';
import StageDiagram from '../../components/admin/processing-flow/StageDiagram';
import StageCard from '../../components/admin/processing-flow/StageCard';
import GapPanel from '../../components/admin/processing-flow/GapPanel';

const { STAGES } = require('../../lib/admin/processing-flow-stages');
const { STAGE_METRICS_STUB } = require('../api/admin/processing-flow/metrics');

const DOC_PATH = path.join(process.cwd(), 'docs/schema-shape/provision-processing-flow.md');
const GAPS_PATH = path.join(process.cwd(), 'docs/schema-shape/processing-flow-gaps.json');

function withStubMetrics(stages, metricsStub) {
  return stages.map((stage) => ({ ...stage, metrics: metricsStub[stage.id] || {} }));
}

ProcessingFlowPage.noLayout = true;

export default function ProcessingFlowPage({ markdown, stages, gaps }) {
  return (
    <div className="min-h-screen bg-bg p-6">
      <AdminNav className="mb-6" />
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Processing flow</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-inkLight">
            Read-only view of the ingest-to-Claim flow: the source doc, the owning file per stage, and
            open gap follow-ups. Last-run metrics below are static placeholders — no metrics pipeline
            has been built yet.
          </p>
        </div>
      </header>

      <main className="space-y-6">
        <StageDiagram markdown={markdown} />

        <section className="space-y-3">
          <h2 className="font-display text-lg text-ink">Stages</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {stages.map((stage) => (
              <StageCard key={stage.id} stage={stage} />
            ))}
          </div>
        </section>

        <section>
          <GapPanel gaps={gaps} />
        </section>

        <footer className="flex flex-wrap items-center gap-4 rounded border border-border bg-white p-4 text-sm" data-testid="processing-flow-legend">
          <span className="font-ui text-[11px] uppercase tracking-wide text-inkFaint">Legend</span>
          <Link href="/admin/taxonomy" className="text-accent hover:underline">
            Taxonomy page
          </Link>
          <span
            className="text-inkFaint"
            title="Master Brief is an external planning doc, not checked into this repo — no link target exists yet."
          >
            Master Brief § 2.9 (external doc, not in this repo)
          </span>
        </footer>
      </main>
    </div>
  );
}

export async function getStaticProps() {
  const markdown = fs.readFileSync(DOC_PATH, 'utf8');
  const gaps = JSON.parse(fs.readFileSync(GAPS_PATH, 'utf8')).gaps || [];
  const stages = withStubMetrics(STAGES, STAGE_METRICS_STUB);
  return { props: { markdown, stages, gaps } };
}
