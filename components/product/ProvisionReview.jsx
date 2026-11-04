import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import PwBar from '../chrome/PwBar';
import ProvisionRail from './ProvisionRail';
import ProvisionTables from './ProvisionTables';
import { Breadcrumbs } from '../UI';
import { displayIdentityParties } from '../../lib/product/identity-display';
import { previewFactsFromWorkspace } from '../../lib/product/provisions-preview';
import { buildReviewView } from '../../lib/product/review-view';
import { displayReviewLabel } from '../../lib/product/review-labels';
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
const FACT_KINDS = new Set(['PROPOSAL', 'USER_FACT']);
const PILL = 'rounded-full border border-[#B9C8DA] bg-white px-[13px] py-[6px] font-ui text-[10.5px] font-semibold text-[#0B3D71] disabled:opacity-40';
const SOLID = 'rounded-full bg-[#03203D] px-[13px] py-[6px] font-ui text-[10.5px] font-semibold text-white disabled:opacity-40';

function StatusBadge({ status }) {
  const published = status === 'PUBLISHED';
  return <span className={`inline-flex items-center rounded-full px-[9px] py-[2px] font-ui text-[9.5px] font-semibold uppercase tracking-[0.08em] ${published ? 'bg-[#03203D] text-white' : 'border border-[#B9C8DA] bg-white text-[#0B3D71]'}`} data-testid="review-status">{published ? 'Published' : 'Draft review'}</span>;
}

// A pending note never holds publication; every other pending or
// unresolved item does (lib/product/review-view.js can_publish).
function blocksPublication(item) {
  if (item.decision === 'UNRESOLVED') return true;
  return item.decision === 'PENDING' && !(item.kind === 'ISSUE' && item.original && item.original.kind === 'NOTE');
}

// Why "Finalise candidate" is not yet open, from the server view's rule:
// the facts this page can decide, the items only the legacy workspace can
// (checks, relationships, coverage, held facts), and the agreement
// coverage confirmation.
export function publicationBlockers({ state, decidableItemIds, canPublish }) {
  if (canPublish || !state || state.status !== 'DRAFT') return [];
  const blocking = (state.items || []).filter(blocksPublication);
  const here = blocking.filter((item) => decidableItemIds.has(item.item_id)).length;
  const elsewhere = blocking.length - here;
  const reasons = [];
  if (here) reasons.push({ key: 'here', text: `${here} ${here === 1 ? 'fact is' : 'facts are'} still to decide on this page.`, legacy: false });
  if (elsewhere) reasons.push({ key: 'legacy', text: `${elsewhere} other review ${elsewhere === 1 ? 'item' : 'items'} (checks, relationships, coverage or held facts) can be decided only in the legacy workspace.`, legacy: true });
  if (state.agreement_coverage?.decision !== 'ACCEPTED') reasons.push({ key: 'coverage', text: 'The agreement coverage is not yet confirmed.', legacy: true });
  if (!reasons.length) reasons.push({ key: 'other', text: 'A grouping or relationship check is not yet met.', legacy: true });
  return reasons;
}

function disagreedLabel(item) {
  const original = item.original || {};
  return item.edited_headline?.summary || original.headline?.summary || original.headline?.label
    || item.edited_statement || original.statement || 'Disagreed fact';
}

// A disagreed fact leaves the tables (the preview shows only facts the
// review keeps), so the page lists them here with an Undo.
function DisagreedList({ items, onReset, busy }) {
  if (!items.length) return null;
  return (
    <details open className="mb-[18px] rounded-[2px] border border-[#B9C8DA] bg-white" data-testid="review-disagreed">
      <summary className="cursor-pointer px-[14px] py-[9px] font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B3D71]">Disagreed ({items.length})</summary>
      <ul className="border-t border-[#DCE3E1]">
        {items.map((item) => (
          <li key={item.item_id} className="flex flex-wrap items-baseline gap-x-[8px] gap-y-[2px] border-b border-[#DCE3E1] px-[14px] py-[8px] last:border-0" data-testid="review-disagreed-item">
            <span className="min-w-0 flex-1 basis-[220px] font-body text-[12.5px] leading-snug text-[#33475E]">{disagreedLabel(item)}</span>
            {item.family_key ? <span className="font-ui text-[10px] uppercase tracking-[0.08em] text-[#6B7785]">{displayReviewLabel(item.family_key)}</span> : null}
            {onReset ? <button type="button" disabled={busy} onClick={() => onReset(item.item_id)} className="font-ui text-[10.5px] font-semibold text-[#0B3D71] underline-offset-2 hover:underline disabled:opacity-40" data-testid="review-disagreed-undo">Undo</button> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

// The page body for a loaded workspace; the default export fetches it and
// sends the commands.
export function ProvisionReviewBody({ workspace, runId, command, busy = false, error = '' }) {
  const preview = useMemo(() => previewFactsFromWorkspace(workspace), [workspace]);
  const view = useMemo(() => buildReviewView(workspace), [workspace]);
  const tableView = useMemo(() => buildTableView({
    facts: preview.facts,
    heldFacts: preview.held_facts || [],
    tableShapes: tableShapesV3,
    legalSchema: legalSchemaV2,
  }), [preview]);

  const state = workspace.review.state || {};
  const title = displayIdentityParties(workspace.analysis.source_document?.display_parties || workspace.analysis.source_document?.parties, 'Agreement review');
  const status = state.status || 'DRAFT';
  const draft = status === 'DRAFT';
  const decidableItemIds = new Set([...preview.reviewItemsByFactId.values()].map((item) => item?.item_id).filter(Boolean));
  const blockers = publicationBlockers({ state, decidableItemIds, canPublish: view.can_publish });
  const disagreed = (state.items || []).filter((item) => FACT_KINDS.has(item.kind) && item.decision === 'REJECTED');
  const legacyHref = `/review/product/${runId}?legacy=1`;
  const reset = draft ? (itemId) => command({ type: 'RESET_ITEM', item_id: itemId }) : null;

  return (
    <div className="flex" data-testid="provision-review-body" data-review-status={status}>
      <ProvisionRail sections={tableShapesV3.sections} title={title} topOffset={58} />
      <div className="min-w-0 flex-1 border-t-[10px] border-[#B9C8DA] px-[max(16px,min(4vw,64px))] py-[clamp(24px,3.5vw,48px)]">
        <Breadcrumbs items={[{ label: 'Review', href: '/review' }, { label: title }]} />
        <header className="mb-[20px]">
          <div className="flex flex-wrap items-center gap-[8px]">
            <p className="m-0 font-ui text-[12px] font-bold uppercase tracking-[0.1em] text-[#0B3D71]">Review</p>
            <StatusBadge status={status} />
            {draft ? <span className="font-ui text-[10px] text-[#6B7785]" data-testid="review-pending-count">{view.pending_count} pending</span> : null}
            <Link href={`/review/product/${runId}/provisions`} className="ml-auto font-ui text-[10.5px] font-semibold text-[#0B3D71] underline-offset-2 hover:underline" data-testid="review-preview-link">Lawyer preview</Link>
          </div>
          <h1 className="mt-[8px] font-sans font-extrabold leading-[.98] tracking-[-.05em]" style={{ fontSize: 'clamp(30px,3.6vw,52px)' }}>{title}</h1>
          <div className="mt-[12px] flex flex-wrap items-center gap-[8px]" data-testid="review-actions">
            {draft ? <>
              <button type="button" disabled={busy} onClick={() => command({ type: 'SAVE_PROGRESS' })} className={PILL} data-testid="review-save">Save progress</button>
              <button type="button" disabled={busy || !view.can_publish} onClick={() => command({ type: 'PUBLISH' })} className={SOLID} data-testid="review-finalise">Finalise candidate</button>
            </> : status === 'PUBLISHED' ? (
              <button type="button" disabled={busy} onClick={() => command({ type: 'REOPEN' })} className={PILL} data-testid="review-revise">Revise</button>
            ) : null}
            <Link href={legacyHref} className="font-ui text-[10.5px] text-[#6B7785] underline-offset-2 hover:underline">Legacy workspace</Link>
          </div>
          {blockers.length ? (
            <ul className="mt-[10px] space-y-[3px] border-l-[3px] border-[#B9C8DA] pl-[10px]" data-testid="review-publish-blockers">
              {blockers.map((reason) => (
                <li key={reason.key} className="font-ui text-[11px] text-[#33475E]">
                  {reason.text}
                  {reason.legacy ? <> <Link href={legacyHref} className="font-semibold text-[#0B3D71] underline-offset-2 hover:underline">Open the legacy workspace</Link></> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {error ? <p role="alert" className="mt-[8px] font-ui text-[11px] text-[#6B4A12]">{error}</p> : null}
        </header>
        <DisagreedList items={disagreed} onReset={reset} busy={busy} />
        <ProvisionTables
          tableView={tableView}
          facts={preview.facts}
          mode="review"
          runId={runId}
          reviewItemsByFactId={preview.reviewItemsByFactId}
          sectionTextByFactId={preview.sectionTextByFactId}
          onDecision={draft ? (itemId, decision) => command({ type: 'DECIDE_ITEM', item_id: itemId, decision }) : null}
          onComment={draft ? (itemId, comment) => command({ type: 'COMMENT_ITEM', item_id: itemId, comment }) : null}
          onReset={reset}
          busy={busy}
        />
      </div>
    </div>
  );
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

  if (!workspace) {
    return <div className="min-h-screen bg-white p-8 font-ui text-sm text-[#33475E]">{error ? <><p role="alert">{error}</p><button type="button" onClick={() => load().catch((failure) => setError(failure.message))} className="mt-3 rounded-full border border-[#B9C8DA] px-4 py-2">Retry</button></> : 'Loading review…'}</div>;
  }

  const title = displayIdentityParties(workspace.analysis.source_document?.display_parties || workspace.analysis.source_document?.parties, 'Agreement review');
  return (
    <div className="min-h-screen bg-white text-[#03203D]" data-testid="provision-review-page">
      <Head><title>{`Review · ${title}`}</title></Head>
      <PwBar active="review" admin />
      <ProvisionReviewBody workspace={workspace} runId={runId} command={command} busy={busy} error={error} />
    </div>
  );
}
