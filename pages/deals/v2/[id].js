import Head from 'next/head';
import Link from 'next/link';
import { Breadcrumbs, EmptyState } from '../../../components/UI';
import ProvisionRail from '../../../components/product/ProvisionRail';
import PwBar from '../../../components/chrome/PwBar';
import ProvisionTables from '../../../components/product/ProvisionTables';
import { buildTableView } from '../../../lib/product/table-view';
import legalSchemaV2 from '../../../contracts/product/legal-schema.v2.json';
import tableShapesV3 from '../../../contracts/product/table-shapes.v3.json';
import { ProductPhase3Store } from '../../../lib/product/phase-3-store';
import { getProductSupabase } from '../../../lib/supabase';

// The released deal page is the lawyer-preview page, released (work package
// 53, finding (299)): the same rail, the same header, the same provision
// tables and evidence, fed by the current release instead of a draft. It is
// server-rendered so the agreement is in the first paint and the page never
// shows a statement list where a table belongs.
export async function getServerSideProps({ params }) {
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  try {
    const client = getProductSupabase();
    if (!client || !id) return { props: { agreement: null, error: null } };
    const store = new ProductPhase3Store({ client });
    const agreements = await store.listPublishedLayeredFacts({});
    const agreement = agreements.find((entry) => entry.source_document_id === id) || null;
    return { props: { agreement, error: null } };
  } catch (failure) {
    return { props: { agreement: null, error: failure.message } };
  }
}

function money(value) { return value ? `$${(Number(value) / 1e9).toFixed(1)}bn` : null; }

export default function ReleasedDealPage({ agreement, error }) {
  if (error) return <div className="p-6"><p className="text-sm font-ui text-red-700">The release could not be read: {error}</p></div>;
  if (!agreement) {
    return (
      <div className="space-y-6 p-6">
        <Breadcrumbs items={[{ label: 'Index', href: '/' }, { label: 'Released agreement' }]} />
        <EmptyState icon="+" title="No released agreement with that id" description="This page reads the current release only." action={<Link href="/" className="text-sm font-ui text-accent hover:underline">Back to the index</Link>} />
      </div>
    );
  }
  const tableView = buildTableView({ facts: agreement.facts, heldFacts: [], tableShapes: tableShapesV3, legalSchema: legalSchemaV2 });
  const unreviewed = agreement.facts.filter((fact) => fact.decided_by_role !== 'LAWYER').length;
  const date = agreement.agreement_date
    ? new Date(agreement.agreement_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  return (
    <div className="pw-provisions min-h-screen bg-white text-[#03203D]" data-testid="released-deal-page">
      <Head><title>{`Corpus - ${agreement.agreement_label}`}</title></Head>
      <PwBar active="index" />
      <div className="flex">
      <ProvisionRail sections={tableShapesV3.sections} title={agreement.agreement_label} />
      <div className="min-w-0 flex-1 border-t-[10px] border-[#B9C8DA] px-[max(16px,min(4vw,64px))] py-[clamp(28px,4vw,56px)]" data-testid="released-screen">
        <header className="mb-[24px]" data-testid="released-header">
          <div className="flex flex-wrap items-center gap-[7px]">
            <p className="font-ui text-[12px] font-bold uppercase tracking-[0.1em] text-[#0B3D71]">Released</p>
            <span className="inline-flex items-center rounded-full bg-green-100 px-[6px] py-[1px] text-[9px] font-ui font-medium uppercase tracking-wide text-green-800">V2</span>
            {agreement.released_with_warning ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-[6px] py-[1px] text-[9px] font-ui font-medium uppercase tracking-wide text-amber-800" data-testid="release-health-warning">Health warning</span>
            ) : null}
            {unreviewed > 0 ? (
              <span className="inline-flex items-center rounded-full bg-[#F1F4F8] px-[6px] py-[1px] text-[9px] font-ui font-medium uppercase tracking-wide text-[#33475E]" data-testid="not-lawyer-reviewed">{unreviewed} facts not lawyer-reviewed</span>
            ) : null}
          </div>
          <h1 className="mt-[10px] font-sans font-extrabold leading-[.96] tracking-[-.05em] text-[#03203D]" style={{ fontSize: 'clamp(34px,4.4vw,62px)' }}>{agreement.agreement_label}</h1>
          <p className="mt-[10px] font-ui text-[12px] uppercase tracking-[0.1em] text-[#6B7785]">
            {[date, `${agreement.facts.length} facts`].filter(Boolean).join(' · ')}
            {agreement.retrieval_url ? <> · <a href={agreement.retrieval_url} target="_blank" rel="noreferrer" className="underline">SEC exhibit</a></> : null}
          </p>
          <div className="mt-[14px] border-t-[10px] border-[#B9C8DA]" />
          {agreement.released_with_warning ? (
            // The design system's one warning shape: wash panel, 6px navy
            // left border, dark text. Not a red banner.
            <p className="mt-[18px] border-l-[6px] border-[#03203D] bg-[#F1F4F8] px-[22px] py-[16px] font-body text-[19px] leading-[1.4] text-[#33475E]" data-testid="release-warning-callout">
              <b className="font-sans tracking-[-.02em]">Health warning.</b>{' '}
              {agreement.release_warning?.detail || 'Released on the owner\'s acknowledgement, not a full lawyer attestation.'}
            </p>
          ) : null}
        </header>
        {agreement.facts.length === 0
          ? <EmptyState icon="" title="No published facts in this release" description="The release exists but carries no layered facts." />
          : <ProvisionTables
              tableView={tableView}
              facts={agreement.facts}
              // The coded answers are the point of the page: pills on, so a
              // reader sees the answer before the words (Ben, 2026-10-27).
              initialShowCodes
              onSource={() => { if (agreement.retrieval_url) window.open(agreement.retrieval_url, '_blank', 'noopener'); }}
            />}
      </div>
      </div>
    </div>
  );
}

ReleasedDealPage.noLayout = true;
