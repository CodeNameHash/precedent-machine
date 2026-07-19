// Review V2 ("Mergertrace") — per-section provision index. Restores the v1
// drill-down layer the summary tables don't carry: every provision card in
// the section, with its section reference and the FULL clause text behind a
// "read clause" expander. Data is the same /api/review/<id>/cards payload
// the tables render from — no extra fetch. The v1 page exposes this detail
// through its sidebar type-groups + per-provision pages; here it lives
// in-body, under each section's summary table.
//
// The wrapper carries a data-testid starting with 'provision-table-' so the
// .mtx table rules in MergertraceStyles (grey header strip, white body,
// 1px #E0E0E0 borders, meta-label voice) skin it like every other card.

import React from 'react';
import { dedupeBySectionAndTitle, isFragmentDefinedTerm } from './provisionIndexHelpers.js';

function sectionRefLabel(ref) {
  // section_ref shape: "1.01 | The Merger | ee3def9710d0" — show §number only.
  const first = String(ref || '').split('|')[0].trim();
  return first ? `§${first}` : '';
}

// Item 16.2 (round 3): dedupe the per-section provision index by
// (section_ref number, short_title) -- ingestion sometimes stores TWO
// cards for the same provision (Theravance: two 6.1 "Information to
// Regulators" cards, 5eea8833… and a2e67986…), which reads out as a
// duplicated entry in the section list. Keep the card with the LONGER
// captured text (the more complete extraction of the two); this is a
// render-time dedupe over stored duplicate rows, not a data delete. Logic
// lives in provisionIndexHelpers.js (plain JS, unit-tested directly).
export default function ProvisionIndex({ cards, sectionTitle, onSelect, selectedId }) {
  const withTitle = (cards || []).filter((c) => c && (c.short_title || c.defined_term));
  const list = dedupeBySectionAndTitle(withTitle);
  if (!list.length) return null;
  return (
    <details className="mt-3">
      <summary className="term-cell-seetext" style={{ listStyle: 'none', cursor: 'pointer' }}>
        Provisions in this section ({list.length}) — read the clauses
      </summary>
      <section data-testid={`provision-table-index-${(sectionTitle || 'section').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="mt-2 border border-border bg-white">
        <div className="border-b border-border bg-paper2 px-3 py-1.5">
          <p>Provisions — {sectionTitle}</p>
        </div>
        <div>
          <table className="min-w-full text-xs font-ui">
            <tbody className="divide-y divide-border">
              {list.map((card) => {
                const text = card.region_full_text || card.primary_quote || '';
                const cardKey = card.id || card.provision_instance_id;
                const isSel = selectedId && cardKey === selectedId;
                return (
                  <tr
                    key={cardKey}
                    className="align-top"
                    onClick={onSelect ? () => onSelect(card) : undefined}
                    style={onSelect ? { cursor: 'pointer', ...(isSel ? { background: 'rgba(47,109,181,.07)', boxShadow: 'inset 2px 0 0 #2F6DB5' } : {}) } : undefined}
                  >
                    <td className="px-3 py-2 align-top" style={{ width: '5rem' }}>
                      <span className="mtx-mono text-[11px] text-[#6B6B6B] whitespace-nowrap">{sectionRefLabel(card.section_ref)}</span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="font-medium text-ink">{card.short_title || card.defined_term}</span>
                      {text ? (
                        <details className="mt-1">
                          <summary className="term-cell-seetext" style={{ listStyle: 'none' }}>read clause</summary>
                          <div className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight">{text}</div>
                        </details>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </details>
  );
}

// Item 16.1 (round 3): fragment defined terms are ingestion junk -- see
// provisionIndexHelpers.js#isFragmentDefinedTerm for the full rule and
// rationale. Filtered defensively at render time (never deleted here --
// see the dry-run scripts/cleanup-fragment-definitions.js for the
// data-side cleanup).
export function DefinitionsSection({ definitions }) {
  const list = (definitions || []).filter((d) => d && d.defined_term && !isFragmentDefinedTerm(d.defined_term));
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => String(a.defined_term).localeCompare(String(b.defined_term)));
  return (
    <section data-testid="provision-table-definitions" className="border border-border bg-white">
      <div className="border-b border-border bg-paper2 px-3 py-1.5">
        <p>Defined terms ({sorted.length})</p>
      </div>
      <div>
        <table className="min-w-full text-xs font-ui">
          <thead className="border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-inkFaint" style={{ width: '16rem' }}>Term</th>
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-inkFaint">Definition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((def) => {
              const full = def.region_full_text || def.primary_quote || '';
              const summary = def.defined_value || '';
              return (
                <tr key={def.id || def.provision_instance_id} className="align-top">
                  <td className="px-3 py-2 align-top font-medium text-ink">{def.defined_term}</td>
                  <td className="px-3 py-2 align-top text-ink">
                    <span className="whitespace-pre-wrap break-words">{summary}</span>
                    {full && full !== summary ? (
                      <details className="mt-1">
                        <summary className="term-cell-seetext" style={{ listStyle: 'none' }}>full text</summary>
                        <div className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight">{full}</div>
                      </details>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
