import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSessionUser } from '../../lib/useSessionUser';
import PwBar from '../../components/chrome/PwBar';
import { Breadcrumbs, EmptyState, SkeletonCard } from '../../components/UI';

const STATUSES = ['open', 'accepted', 'rejected', 'done'];
const LEVELS = [
  ['PARTNER', 'Partner'],
  ['SENIOR_ASSOCIATE', 'Senior associate'],
  ['MID_LEVEL_ASSOCIATE', 'Mid-level associate'],
  ['JUNIOR_ASSOCIATE', 'Junior associate'],
];
const KINDS = [
  ['WRONG_ANSWER', 'Wrong answer'],
  ['MISSING', 'Missing'],
  ['UNCLEAR', 'Unclear'],
  ['OTHER', 'Other'],
];
const STATUS_STYLE = {
  open: 'border border-[#B9C8DA] bg-white text-[#0B3D71]',
  accepted: 'bg-[#03203D] text-white',
  rejected: 'bg-[#F1F4F8] text-[#6B7785]',
  done: 'bg-[#EAF0F6] text-[#0B3D71]',
};

function labelOf(list, value) {
  return (list.find(([key]) => key === value) || [null, value || '—'])[1];
}

export default function FeedbackAdminPage() {
  const router = useRouter();
  const session = useSessionUser();
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: 'open', run: '', level: '', kind: '' });
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session.loading && !session.admin) router.replace('/');
  }, [router, session.admin, session.loading]);

  async function load() {
    setError('');
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    const response = await fetch(`/api/product/feedback?${params.toString()}`, { headers: { accept: 'application/json' } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Feedback could not be read');
    setFeedback(body.feedback || []);
  }
  useEffect(() => {
    if (session.loading || !session.admin) return;
    load().catch((failure) => setError(failure.message));
  }, [session.loading, session.admin, filters.status, filters.run, filters.level, filters.kind]);

  async function resolve(item, status) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/product/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-PM-CSRF': 'same-origin' },
        body: JSON.stringify({ id: item.id, status, resolution_note: notes[item.id] || item.resolution_note || 'Reviewed in the feedback list.' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Feedback could not be updated');
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  const field = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  return (
    <div className="min-h-screen bg-white text-[#03203D]" data-testid="feedback-admin">
      <Head><title>Feedback · Corpus</title></Head>
      <PwBar active="index" admin />
      <div className="border-t-[10px] border-[#B9C8DA] px-[max(16px,min(6vw,96px))] py-[clamp(24px,4vw,48px)]">
        <Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Feedback' }]} />
        <p className="font-ui text-[12px] font-bold uppercase tracking-[0.1em] text-[#0B3D71]">Admin</p>
        <h1 className="mt-[8px] font-sans text-[36px] font-extrabold leading-[.98] tracking-[-.05em]">Feedback</h1>
        <p className="mt-[8px] max-w-[70ch] font-body text-[16px] leading-relaxed text-[#33475E]">What readers flagged, with the page, section, table, row and cell they were looking at. Accept, reject or mark it done; the reviewer’s level is recorded with it.</p>

        <div className="mt-[20px] flex flex-wrap items-end gap-[10px] border-b border-[#DCE3E1] pb-[10px]">
          <label className="font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7785]">Status
            <select value={filters.status} onChange={(event) => field('status', event.target.value)} className="mt-[3px] block rounded-full border border-[#B9C8DA] bg-white px-[10px] py-[5px] font-ui text-[11px] text-[#03203D]">
              <option value="">All</option>
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7785]">Level
            <select value={filters.level} onChange={(event) => field('level', event.target.value)} className="mt-[3px] block rounded-full border border-[#B9C8DA] bg-white px-[10px] py-[5px] font-ui text-[11px] text-[#03203D]">
              <option value="">All</option>
              {LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7785]">Kind
            <select value={filters.kind} onChange={(event) => field('kind', event.target.value)} className="mt-[3px] block rounded-full border border-[#B9C8DA] bg-white px-[10px] py-[5px] font-ui text-[11px] text-[#03203D]">
              <option value="">All</option>
              {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7785]">Run
            <input value={filters.run} onChange={(event) => field('run', event.target.value)} placeholder="run id" className="mt-[3px] block w-[260px] rounded-full border border-[#B9C8DA] px-[10px] py-[5px] font-ui text-[11px] text-[#03203D]" />
          </label>
          <button type="button" onClick={() => load().catch((failure) => setError(failure.message))} className="rounded-full bg-[#03203D] px-[13px] py-[6px] font-ui text-[11px] font-semibold text-white">Refresh</button>
          <Link href="/admin" className="font-ui text-[11px] text-[#0B3D71] underline-offset-2 hover:underline">Admin home</Link>
        </div>

        {error ? <p className="mt-[10px] font-ui text-[12px] text-[#6B4A12]" role="alert">{error}</p> : null}
        {feedback === null ? <div className="mt-[16px]"><SkeletonCard /></div> : null}
        {feedback && feedback.length === 0 ? <div className="mt-[16px]"><EmptyState icon="" title="No feedback" description="Nothing matches these filters." /></div> : null}
        {feedback && feedback.length > 0 ? (
          <div className="mt-[16px] space-y-[10px]">
            {feedback.map((item) => (
              <article key={item.id} className="border border-[#DCE3E1] bg-white p-[14px]" data-testid="feedback-item">
                <div className="flex flex-wrap items-center gap-[7px]">
                  <span className={`inline-flex items-center rounded-full px-[8px] py-[2px] font-ui text-[9px] font-semibold uppercase tracking-[0.08em] ${STATUS_STYLE[item.status] || STATUS_STYLE.open}`} data-testid="feedback-status">{item.status}</span>
                  <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B7785]">{labelOf(KINDS, item.kind)}</span>
                  <span className="font-ui text-[10px] text-[#6B7785]">{item.author_name || item.author_id || 'Unknown'} · {labelOf(LEVELS, item.author_level)}</span>
                  <span className="ml-auto font-ui text-[10px] text-[#6B7785]">{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-[7px] font-body text-[13px] leading-relaxed text-[#33475E]" data-testid="feedback-body">{item.body}</p>
                <p className="mt-[5px] font-ui text-[10.5px] text-[#6B7785]" data-testid="feedback-context">
                  {item.page_path || '/'}{item.section_key ? `#provision-section-${item.section_key}` : ''}
                  {[item.table_key, item.row_subject, item.column_id, item.cell_code || item.cell_label].filter(Boolean).map((part) => ` · ${part}`).join('')}
                </p>
                <div className="mt-[8px] flex flex-wrap items-center gap-[6px]">
                  <input value={notes[item.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Resolution note" className="min-w-[220px] flex-1 rounded-full border border-[#B9C8DA] px-[10px] py-[5px] font-ui text-[11px]" />
                  <button type="button" disabled={busy} onClick={() => resolve(item, 'accepted')} className="rounded-full bg-[#03203D] px-[11px] py-[4px] font-ui text-[10.5px] font-semibold text-white disabled:opacity-40">Accept</button>
                  <button type="button" disabled={busy} onClick={() => resolve(item, 'rejected')} className="rounded-full border border-[#B9C8DA] px-[11px] py-[4px] font-ui text-[10.5px] font-semibold text-[#0B3D71] disabled:opacity-40">Reject</button>
                  <button type="button" disabled={busy} onClick={() => resolve(item, 'done')} className="rounded-full border border-[#B9C8DA] px-[11px] py-[4px] font-ui text-[10.5px] font-semibold text-[#0B3D71] disabled:opacity-40">Done</button>
                  {item.page_path ? <Link href={`${item.page_path}${item.section_key ? `#provision-section-${item.section_key}` : ''}`} className="font-ui text-[10.5px] text-[#0B3D71] underline-offset-2 hover:underline">Open</Link> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

FeedbackAdminPage.noLayout = true;
