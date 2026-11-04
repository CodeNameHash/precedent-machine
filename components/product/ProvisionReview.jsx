import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import PwBar from '../chrome/PwBar';
import ProvisionRail from './ProvisionRail';
import ProvisionTables from './ProvisionTables';
import { Breadcrumbs } from '../UI';
import { displayIdentityParties } from '../../lib/product/identity-display';
import { previewFactsFromWorkspace } from '../../lib/product/provisions-preview';
import { buildTableView } from '../../lib/product/table-view';
import legalSchemaV2 from '../../contracts/product/legal-schema.v2.json';
import tableShapesV3 from '../../contracts/product/table-shapes.v3.json';

// The review page as the provisions page in review mode (work package 3).
// The answers stay the page's own tables; each row's "See reason" opens the
// provision text and the interpretation tree inline, with Agree / Disagree /
// Comment writing through the existing review API (the same POST and state
// machine as the old ReviewWorkspace). `?legacy=1` still renders that old
// workspace.
const HEADERS = { 'Content-Type': 'application/json', 'X-PM-CSRF': 'same-origin' };

function StatusBadge({ status }) {
  const published = status === 'PUBLISHED';
  return <span className={`inline-flex items-center rounded-full px-[9px] py-[2px] font-ui text-[9.5px] font-semibold uppercase tracking-[0.08em] ${published ? 'bg-[#03203D] text-white' : 'border border-[#B9C8DA] bg-white text-[#0B3D71]'}`} data-testid="review-status">{published ? 'Published' : 'Draft review'}</span>;
}

export default function ProvisionReview({ runId }) {
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setError('');
    const response = await fetch(`/api/product/review/${runId}`, { cache: 'no-store' });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Review could not load');
    setWorkspace(value);
  }
  useEffect(() => { load().catch((failure) => setError(failure.message)); }, [runId]);

  const preview = useMemo(() => (workspace ? previewFactsFromWorkspace(workspace) : null), [workspace]);
  const tableView = useMemo(() => (preview ? buildTableView({
    facts: preview.facts,
    heldFacts: preview.held_facts || [],
    tableShapes: tableShapesV3,
    legalSchema: legalSchemaV2,
  }) : null), [preview]);

  async function command(value) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/product/review/${runId}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ expected_version: workspace.review.version, idempotency_key: crypto.randomUUID(), command: value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || 'Review action failed');
      setWorkspace(result);
      return result;
    } catch (failure) {
      setError(failure.message);
      try { await load(); } catch { /* keep the last error */ }
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (!workspace || !preview || !tableView) {
    return <div className="min-h-screen bg-white p-8 font-ui text-sm text-[#33475E]">{error ? <><p role="alert">{error}</p><button type="button" onClick={() => load().catch((failure) => setError(failure.message))} className="mt-3 rounded-full border border-[#B9C8DA] px-4 py-2">Retry</button></> : 'Loading review…'}</div>;
  }

  const title = displayIdentityParties(workspace.analysis.source_document?.display_parties || workspace.analysis.source_document?.parties, 'Agreement review');
  const status = workspace.review.state?.status || 'DRAFT';
  const pending = (workspace.review.state?.items || []).filter((item) => item.decision === 'PENDING').length;

  return (
    <div className="min-h-screen bg-white text-[#03203D]" data-testid="provision-review-page">
      <Head><title>{`Review · ${title}`}</title></Head>
      <PwBar active="review" admin />
      <div className="flex">
        <ProvisionRail sections={tableShapesV3.sections} title={title} topOffset={58} />
        <div className="min-w-0 flex-1 border-t-[10px] border-[#B9C8DA] px-[max(16px,min(4vw,64px))] py-[clamp(24px,3.5vw,48px)]">
          <Breadcrumbs items={[{ label: 'Review', href: '/review' }, { label: title }]} />
          <header className="mb-[20px]">
            <div className="flex flex-wrap items-center gap-[8px]">
              <p className="m-0 font-ui text-[12px] font-bold uppercase tracking-[0.1em] text-[#0B3D71]">Review</p>
              <StatusBadge status={status} />
              <span className="font-ui text-[10px] text-[#6B7785]">{pending} pending</span>
              <Link href={`/review/product/${runId}/provisions`} className="ml-auto font-ui text-[10.5px] font-semibold text-[#0B3D71] underline-offset-2 hover:underline" data-testid="review-preview-link">Lawyer preview</Link>
            </div>
            <h1 className="mt-[8px] font-sans font-extrabold leading-[.98] tracking-[-.05em]" style={{ fontSize: 'clamp(30px,3.6vw,52px)' }}>{title}</h1>
            <div className="mt-[12px] flex flex-wrap items-center gap-[8px]">
              <button type="button" disabled={busy} onClick={() => command({ type: 'SAVE_PROGRESS' })} className="rounded-full border border-[#B9C8DA] bg-white px-[13px] py-[6px] font-ui text-[10.5px] font-semibold text-[#0B3D71] disabled:opacity-40">Save progress</button>
              {status === 'DRAFT' ? <button type="button" disabled={busy} onClick={() => command({ type: 'PUBLISH' })} className="rounded-full bg-[#03203D] px-[13px] py-[6px] font-ui text-[10.5px] font-semibold text-white disabled:opacity-40">Finalise candidate</button> : null}
              <Link href={`/review/product/${runId}?legacy=1`} className="font-ui text-[10.5px] text-[#6B7785] underline-offset-2 hover:underline">Legacy workspace</Link>
            </div>
            {error ? <p role="alert" className="mt-[8px] font-ui text-[11px] text-[#6B4A12]">{error}</p> : null}
          </header>
          <ProvisionTables
            tableView={tableView}
            facts={preview.facts}
            mode="review"
            runId={runId}
            reviewItemsByFactId={preview.reviewItemsByFactId}
            sectionTextByFactId={preview.sectionTextByFactId}
            onDecision={(itemId, decision) => command({ type: 'DECIDE_ITEM', item_id: itemId, decision })}
            onComment={(itemId, comment) => command({ type: 'COMMENT_ITEM', item_id: itemId, comment })}
            busy={busy}
          />
        </div>
      </div>
    </div>
  );
}
