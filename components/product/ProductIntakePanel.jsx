import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

const csrfHeaders = { 'Content-Type': 'application/json', 'X-PM-CSRF': 'same-origin' };

export default function ProductIntakePanel() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => () => { active.current = false; }, []);
  useEffect(() => {
    const savedRun = Array.isArray(router.query.productRun) ? router.query.productRun[0] : router.query.productRun;
    if (router.isReady && savedRun && !run) readRun(savedRun).catch((failure) => setError(failure.message));
  }, [router.isReady, router.query.productRun]);

  async function readRun(runId) {
    const response = await fetch(`/api/product/analysis/${runId}`, { cache: 'no-store' });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Could not read analysis');
    if (active.current) setRun(value);
    if (value.status === 'READY') await router.push(`/review/product/${runId}`);
    return value;
  }

  async function advance(runId, retry = false) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/product/analysis/${runId}/run`, { method: 'POST', headers: csrfHeaders, body: JSON.stringify(retry ? { retry: true, idempotency_key: crypto.randomUUID() } : {}) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Analysis could not continue');
      if (active.current) setRun(value);
      if (value.status === 'READY') await router.push(`/review/product/${runId}`);
      else if (['QUEUED', 'RUNNING'].includes(value.status) && value.stage !== 'DOCUMENT_IDENTITY_REVIEW'
        && value.progress?.failed === 0 && value.progress?.completed < value.progress?.total) {
        setTimeout(() => { if (active.current) advance(runId); }, 250);
      }
    } catch (failure) {
      if (active.current) setError(failure.message);
    } finally {
      if (active.current) setBusy(false);
    }
  }

  async function confirmIdentity() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/product/analysis/${run.run_id}/identity`, { method: 'POST', headers: csrfHeaders, body: '{}' });
      const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Identity confirmation failed');
      setRun(value); await advance(run.run_id);
    } catch (failure) { setError(failure.message); setBusy(false); }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/product/intake', {
        method: 'POST', headers: csrfHeaders,
        body: JSON.stringify({
          url: url.trim(), idempotencyKey: crypto.randomUUID(), schemaVersion: 'LEGAL_SCHEMA/V1',
          promptBundleVersion: 'PRODUCT_PHASE2/V1', modelConfig: { provider: 'ANTHROPIC', model: 'server-configured' },
          explicitGeneration: 0, maxAttempts: 3,
        }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'SEC submission failed');
      setRun({ ...value, progress: { total: 0, completed: 0, failed: 0, cost_microusd: 0 } });
      await router.replace({ pathname: '/review', query: { productRun: value.run_id } }, undefined, { shallow: true });
      await advance(value.run_id);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!run?.run_id || run.status === 'READY') return undefined;
    const timer = setInterval(() => { readRun(run.run_id).catch(() => {}); }, 1500);
    return () => clearInterval(timer);
  }, [run?.run_id, run?.status]);

  const progress = run?.progress;
  return (
    <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg text-ink">Analyse an SEC agreement</h2>
      <p className="mt-1 text-sm text-inkLight">Paste the exact SEC exhibit URL. Analysis saves one section at a time.</p>
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input aria-label="SEC exhibit URL" type="url" required value={url} onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.sec.gov/Archives/edgar/data/.../exhibit.htm"
          className="min-w-0 flex-1 rounded-md border border-border px-3 py-2 text-sm" />
        <button type="submit" disabled={busy} className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Working…' : 'Analyse'}
        </button>
      </form>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      {run ? (
        <div className="mt-4 rounded-lg bg-paper p-3 text-sm text-inkMid" data-testid="product-run-status">
          <div className="flex flex-wrap justify-between gap-2"><strong>{run.status}</strong><span>{run.stage}</span></div>
          {progress ? <p className="mt-1">{progress.completed}/{progress.total} sections, {progress.failed} failed, ${(Number(progress.cost_microusd || 0) / 1000000).toFixed(4)} model cost</p> : null}
          {run.stage === 'DOCUMENT_IDENTITY_REVIEW' ? <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-3"><p className="font-semibold text-amber-900">Confirm document identity</p><dl className="mt-2 grid gap-1 text-xs"><div><dt className="inline font-semibold">Parties: </dt><dd className="inline">{run.source_identity?.parties?.join(' / ') || 'Not identified'}</dd></div><div><dt className="inline font-semibold">Filing: </dt><dd className="inline">{run.source_identity?.filing_accession || 'Unknown'} · {run.source_identity?.exhibit_filename || 'Unknown exhibit'}</dd></div><div><dt className="inline font-semibold">Agreement date: </dt><dd className="inline">{run.source_identity?.agreement_date || 'Not identified'}</dd></div></dl>{run.identity_review?.reasons?.length ? <ul className="mt-2 list-disc pl-4 text-xs text-amber-800">{run.identity_review.reasons.map((reason) => <li key={typeof reason === 'string' ? reason : JSON.stringify(reason)}>{typeof reason === 'string' ? reason : reason.message || reason.code || JSON.stringify(reason)}</li>)}</ul> : null}<button type="button" onClick={confirmIdentity} disabled={busy} className="mt-2 rounded border border-amber-700 px-3 py-1 font-semibold text-amber-900">Confirm this agreement</button></div> : null}
          {(progress?.failed > 0 || run.status === 'PARTIAL' || run.status === 'FAILED') ? (
            <button type="button" onClick={() => advance(run.run_id, true)} disabled={busy} className="mt-2 rounded border border-ink px-3 py-1 font-semibold">Retry failed sections</button>
          ) : null}
          {!busy && ['QUEUED', 'RUNNING'].includes(run.status) && run.stage !== 'DOCUMENT_IDENTITY_REVIEW' ? <button type="button" onClick={() => advance(run.run_id)} className="mt-2 rounded border border-ink px-3 py-1 font-semibold">Continue analysis</button> : null}
        </div>
      ) : null}
    </section>
  );
}
