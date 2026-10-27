import { useEffect, useState } from 'react';
import Link from 'next/link';

// The V2 releases on the index (work package 53, plan finding (293)): the
// index is the corpus, and the corpus now has two generations — the 40 V1
// deals in the table below and whatever has been released under V2. Each
// release is badged, links to its released-deal page, and carries the health
// warning when the owner released it without a lawyer attestation.
export default function ReleasedV2Strip() {
  const [agreements, setAgreements] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/product/published-facts', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body) => { if (!cancelled) setAgreements(body.agreements || []); })
      .catch(() => { if (!cancelled) setAgreements([]); });
    return () => { cancelled = true; };
  }, []);
  if (!agreements || agreements.length === 0) return null;
  return (
    <section className="pw-v2-strip" aria-label="Released under V2" data-testid="released-v2-strip">
      <h2>Released under V2 <span className="pw-v2-count">{agreements.length}</span></h2>
      <ul>
        {agreements.map((agreement) => {
          const label = String(agreement.agreement_label || '').split('/').pop() || String(agreement.source_document_id).slice(0, 10);
          return (
            <li key={agreement.source_document_id}>
              <Link href={`/deals/v2/${agreement.source_document_id}`}>
                <span className="pw-v2-badge">V2</span>
                <span className="pw-v2-label">{label.replace(/[-_]/g, ' ')}</span>
                <span className="pw-v2-facts">{agreement.facts.length} facts</span>
                {agreement.released_with_warning ? <span className="pw-v2-warning">health warning</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <style jsx>{`
        .pw-v2-strip { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 14px 18px; margin: 18px 0; }
        .pw-v2-strip h2 { margin: 0 0 8px; font: 600 13px/1.2 var(--font-ui, Arial); letter-spacing: .04em; text-transform: uppercase; color: var(--ink-faint); }
        .pw-v2-count { margin-left: 6px; color: var(--accent-deep); }
        .pw-v2-strip ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
        .pw-v2-strip a { display: flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; font: 14px/1.3 var(--font-ui, Arial); }
        .pw-v2-strip a:hover { text-decoration: underline; }
        .pw-v2-badge { background: var(--accent-deep, #0B3D71); color: #fff; font: 700 10px/1 var(--font-mono, monospace); letter-spacing: .08em; padding: 3px 5px; border-radius: 3px; }
        .pw-v2-label { font-weight: 600; }
        .pw-v2-facts { color: var(--ink-faint); font-size: 12px; }
        .pw-v2-warning { margin-left: auto; color: #92400e; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 999px; padding: 2px 8px; font-size: 11px; }
      `}</style>
    </section>
  );
}
