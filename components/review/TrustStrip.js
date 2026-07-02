import { useState, useEffect } from 'react';

/* Trust strip — the deal's self-audit, rendered under the deal header.
   Pulls /api/trust/report (pure read, no AI): what % of the agreement's text
   is covered by some provision, and what % of extracted "verbatim" quotes
   actually appear in the source. Expands to the largest uncovered gaps and
   the flagged quotes so "what did we miss / what can't we prove" is a glance. */
export function TrustStrip({ dealId, onJump, onEditProvisionById }) {
  const [report, setReport] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  // #14: how to order the uncovered blocks — by size (default) or by their
  // position in the document. minGap filters out short blocks.
  const [gapSort, setGapSort] = useState('size');
  const [minGapK, setMinGapK] = useState(0);
  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    fetch(`/api/trust/report?deal_id=${dealId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) (d && d.coverage ? setReport(d) : setFailed(true)); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [dealId]);
  if (failed) return null; // trust info is additive — never block the page
  if (!report) {
    return (
      <p className="text-[11px] font-ui text-inkFaint mt-2">Verifying quotes &amp; coverage…</p>
    );
  }
  const cov = report.coverage;
  const q = report.quotes;
  const uncoded = report.uncoded || { count: 0, items: [] };
  const covColor = cov.pct >= 90 ? 'text-emerald-700' : cov.pct >= 75 ? 'text-amber-700' : 'text-red-700';
  const qColor = q.verified_pct == null ? 'text-inkFaint' : q.verified_pct >= 95 ? 'text-emerald-700' : q.verified_pct >= 85 ? 'text-amber-700' : 'text-red-700';
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11.5px] font-ui text-inkLight hover:text-ink flex items-center gap-2"
        title="Click for uncovered gaps and unverified quotes"
      >
        <span>
          Coverage <span className={`font-semibold ${covColor}`}>{cov.pct}%</span> of agreement text
          {cov.excludedChars > 0 && (
            <span className="text-inkFaint"> (excl. {Math.round(cov.excludedChars / 1000)}k of exhibits)</span>
          )}
          {uncoded.count > 0 && (
            <span className="text-amber-700"> · {uncoded.count} uncoded</span>
          )}
        </span>
        <span className="text-inkFaint">·</span>
        <span>
          Quotes <span className={`font-semibold ${qColor}`}>{q.verified_pct == null ? '—' : `${q.verified_pct}%`}</span> verified
          {q.unverified > 0 && <span className="text-inkFaint"> ({q.unverified} flagged)</span>}
        </span>
        <span className="text-[9px] text-inkFaint">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-2 border border-border rounded-lg bg-white p-3 space-y-3 text-[11.5px] font-ui">
          {cov.excludedRegions && cov.excludedRegions.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-inkFaint uppercase tracking-wider mb-1">
                Excluded from coverage (attached documents, not merger-agreement provisions)
              </p>
              <ul className="space-y-1">
                {cov.excludedRegions.map((r, i) => (
                  <li key={i} className="text-inkLight capitalize">
                    <span className="text-inkFaint font-mono text-[10px]">{(r.length / 1000).toFixed(1)}k chars</span>{' '}
                    {r.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cov.gaps.length > 0 && (() => {
            const shown = cov.gaps
              .filter((g) => g.length >= minGapK * 1000)
              .slice()
              .sort((a, b) => (gapSort === 'size' ? b.length - a.length : a.start - b.start));
            return (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-medium text-inkFaint uppercase tracking-wider">
                  Uncovered blocks ({shown.length}{shown.length !== cov.gaps.length ? ` of ${cov.gaps.length}` : ''})
                </p>
                <div className="flex items-center gap-2 text-[10px] font-ui">
                  <span className="text-inkFaint">sort</span>
                  <button type="button" onClick={() => setGapSort('size')} className={gapSort === 'size' ? 'text-accent font-medium' : 'text-inkFaint hover:text-ink'}>size</button>
                  <button type="button" onClick={() => setGapSort('position')} className={gapSort === 'position' ? 'text-accent font-medium' : 'text-inkFaint hover:text-ink'}>position</button>
                  <span className="text-border">|</span>
                  <span className="text-inkFaint">min</span>
                  {[0, 1, 5].map((k) => (
                    <button key={k} type="button" onClick={() => setMinGapK(k)} className={minGapK === k ? 'text-accent font-medium' : 'text-inkFaint hover:text-ink'}>{k === 0 ? 'all' : `${k}k`}</button>
                  ))}
                </div>
              </div>
              <ul className="space-y-1">
                {shown.map((g, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => onJump && onJump(g.preview)}
                      className="text-left text-inkLight hover:text-accent hover:underline"
                      title="Jump to this uncovered block in the document"
                    >
                      <span className="text-inkFaint font-mono text-[10px]">{(g.length / 1000).toFixed(1)}k chars</span>{' '}
                      <span className="italic">“{g.preview.slice(0, 140)}”</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            );
          })()}
          {q.failures.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-inkFaint uppercase tracking-wider mb-1">
                Unverified quotes ({q.unverified}{q.failures.length < q.unverified ? `, showing ${q.failures.length}` : ''})
              </p>
              <p className="text-[10px] text-inkFaint mb-1.5 leading-relaxed">
                A quote our matcher couldn&apos;t find verbatim in the source. To resolve: <b>Find</b> jumps
                to where it should be; <b>Edit</b> opens the provision to correct the quote or clear the
                feature if the model invented it. Quotes tagged &ldquo;found in clause&rdquo; are almost
                always a normalization miss, not a hallucination.
              </p>
              <ul className="space-y-1.5">
                {q.failures.slice(0, 10).map((f, i) => (
                  <li key={i} className="text-inkLight">
                    <span className="text-inkFaint">[{f.type} · {f.category}]</span>{' '}
                    <span className="italic">“{f.quote.slice(0, 140)}”</span>
                    {f.in_provision_text && <span className="text-emerald-700/80"> · likely normalization (found in clause)</span>}
                    <span className="ml-1 inline-flex gap-1.5 whitespace-nowrap">
                      <button type="button" onClick={() => onJump && onJump(f.quote)} className="text-accent hover:underline" title="Jump to this quote in the document">Find</button>
                      {f.provision_id && onEditProvisionById && (
                        <button type="button" onClick={() => onEditProvisionById(f.provision_id)} className="text-accent hover:underline" title="Open the provision to correct the quote">Edit</button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {uncoded.count > 0 && (
            <div>
              <p className="text-[10px] font-medium text-inkFaint uppercase tracking-wider mb-1">
                Uncoded provisions ({uncoded.count}{uncoded.items.length < uncoded.count ? `, showing ${uncoded.items.length}` : ''})
              </p>
              <p className="text-[10px] text-inkFaint mb-1.5 leading-relaxed">
                Provisions with no canonical rubric code (proposed / freeform / unset) — the remainder
                behind the coverage figure. <b>Edit</b> opens the provision to classify it.
              </p>
              <ul className="space-y-1.5">
                {uncoded.items.map((u, i) => (
                  <li key={i} className="text-inkLight">
                    <span className="text-inkFaint">[{u.type || '—'} · {u.category || '—'}]</span>
                    {u.proposed && <span className="text-amber-700/80"> · proposed</span>}
                    {u.provision_id && onEditProvisionById && (
                      <span className="ml-1 inline-flex gap-1.5 whitespace-nowrap">
                        <button type="button" onClick={() => onEditProvisionById(u.provision_id)} className="text-accent hover:underline" title="Open the provision to classify it">Edit</button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cov.gaps.length === 0 && q.failures.length === 0 && uncoded.count === 0 && (
            <p className="text-inkFaint italic">No significant gaps or unverified quotes.</p>
          )}
        </div>
      )}
    </div>
  );
}
