import { useEffect, useState } from 'react';

// One feedback form for the whole page: the evidence sidebar's Feedback
// control and each section heading's Report link open it with the exact
// context already captured. It POSTs to /api/product/feedback; the reviewer
// and level are read server-side from the session and the reviewer cookie.
const KINDS = [
  ['WRONG_ANSWER', 'Wrong answer'],
  ['MISSING', 'Missing'],
  ['UNCLEAR', 'Unclear'],
  ['OTHER', 'Other'],
];

export default function FeedbackDialog({ open, context = null, runId = null, onClose = () => {} }) {
  const [kind, setKind] = useState('WRONG_ANSWER');
  const [body, setBody] = useState('');
  const [state, setState] = useState({ busy: false, error: '', done: false });
  useEffect(() => {
    if (!open) return;
    setState({ busy: false, error: '', done: false });
    setBody('');
    setKind('WRONG_ANSWER');
  }, [open]);
  if (!open) return null;
  async function submit(event) {
    event.preventDefault();
    if (!body.trim() || !runId) return;
    setState({ busy: true, error: '', done: false });
    try {
      const response = await fetch('/api/product/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PM-CSRF': 'same-origin' },
        body: JSON.stringify({
          run_id: runId,
          page_path: typeof window !== 'undefined' ? window.location.pathname : null,
          section_key: context?.section_key || null,
          table_key: context?.table_key || null,
          row_subject: context?.row_subject || null,
          column_id: context?.column_id || null,
          cell_code: context?.cell_code || null,
          cell_label: context?.cell_label || null,
          fact_ids: context?.fact_ids || [],
          kind,
          body,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Feedback could not be saved');
      setState({ busy: false, error: '', done: true });
      setBody('');
    } catch (failure) {
      setState({ busy: false, error: failure.message, done: false });
    }
  }
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#03203D]/30 p-[16px] sm:items-center" role="dialog" aria-modal="true" aria-label="Report feedback" data-testid="feedback-dialog">
      <form onSubmit={submit} className="w-full max-w-[520px] rounded-[2px] border border-[#B9C8DA] bg-white p-[20px] shadow-none">
        <div className="flex items-start justify-between gap-[8px]">
          <div>
            <p className="font-ui text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#6B7785]">Feedback</p>
            <h2 className="mt-[4px] font-sans text-[20px] font-bold tracking-[-.03em] text-[#03203D]">What looks wrong?</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close feedback" className="text-[20px] leading-none text-[#6B7785]">×</button>
        </div>
        {context?.section_key || context?.row_subject ? (
          <p className="mt-[8px] font-body text-[11.5px] leading-snug text-[#6B7785]" data-testid="feedback-context">
            {[context.section_key, context.row_subject, context.cell_label].filter(Boolean).join(' · ')}
          </p>
        ) : null}
        {state.done ? (
          <div className="mt-[14px]" data-testid="feedback-thanks">
            <p className="font-body text-[13px] text-[#33475E]">Thank you. The feedback is saved with the section, table and cell you were looking at.</p>
            <button type="button" onClick={onClose} className="mt-[12px] rounded-full bg-[#03203D] px-[14px] py-[6px] font-ui text-[11px] font-semibold text-white">Close</button>
          </div>
        ) : (
          <>
            <label className="mt-[12px] block font-ui text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#6B7785]" htmlFor="feedback-kind">Kind</label>
            <select id="feedback-kind" value={kind} onChange={(event) => setKind(event.target.value)} className="mt-[4px] w-full rounded-[2px] border border-[#B9C8DA] bg-white px-[9px] py-[7px] font-ui text-[12px] text-[#03203D]">
              {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <label className="mt-[12px] block font-ui text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#6B7785]" htmlFor="feedback-body">What is wrong or missing?</label>
            <textarea id="feedback-body" required value={body} onChange={(event) => setBody(event.target.value)} rows={4} className="mt-[4px] w-full rounded-[2px] border border-[#B9C8DA] px-[9px] py-[7px] font-body text-[13px] text-[#33475E] focus:outline-none focus:ring-1 focus:ring-[#03203D]" placeholder="A sentence or two is enough." />
            {state.error ? <p className="mt-[7px] font-ui text-[11px] text-[#6B4A12]" role="alert">{state.error}</p> : null}
            <div className="mt-[14px] flex items-center justify-end gap-[8px]">
              <button type="button" onClick={onClose} className="font-ui text-[11px] text-[#6B7785]">Cancel</button>
              <button type="submit" disabled={state.busy || !body.trim()} className="rounded-full bg-[#03203D] px-[14px] py-[6px] font-ui text-[11px] font-semibold text-white disabled:opacity-40">{state.busy ? 'Saving…' : 'Send feedback'}</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
