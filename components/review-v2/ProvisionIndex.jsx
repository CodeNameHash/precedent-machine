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
import {
  dedupeBySectionAndTitle,
  definitionSummaryForDisplay,
  definitionTextForDisplay,
  isFragmentDefinedTerm,
} from './provisionIndexHelpers.js';
import { SeeProvisionDisclosure } from '../review/primitives/ProvisionTablePrimitives';

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
export default function ProvisionIndex({ cards, sectionTitle, onSelect, selectedId, onViewInAgreement }) {
  const withTitle = (cards || []).filter((c) => c && (c.short_title || c.defined_term));
  const list = dedupeBySectionAndTitle(withTitle);
  if (!list.length) return null;
  return (
    <SeeProvisionDisclosure
      as="div"
      className="mt-3"
      label={`Provisions in this section (${list.length}) — read the clauses`}
    >
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
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-ink">{card.short_title || card.defined_term}</span>
                        {onViewInAgreement ? (
                          <button
                            type="button"
                            className="mtx-view-in-agreement shrink-0"
                            onClick={(e) => { e.stopPropagation(); onViewInAgreement(card); }}
                            data-testid="view-in-agreement-row"
                          >
                            View in agreement ↗
                          </button>
                        ) : null}
                      </div>
                      {text ? (
                        <SeeProvisionDisclosure
                          className="mt-1"
                          label="read clause"
                          bodyClassName="mt-1 whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight"
                        >
                          {text}
                        </SeeProvisionDisclosure>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </SeeProvisionDisclosure>
  );
}

// Item 16.1 (round 3): fragment defined terms are ingestion junk -- see
// provisionIndexHelpers.js#isFragmentDefinedTerm for the full rule and
// rationale. Filtered defensively at render time (never deleted here --
// see the dry-run scripts/cleanup-fragment-definitions.js for the
// data-side cleanup).
export function DefinitionsSection({ definitions }) {
  const [expandedId, setExpandedId] = React.useState(null);
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
              const rowId = def.id || def.provision_instance_id || def.defined_term;
              const definitionText = definitionSummaryForDisplay(def);
              const provisionText = definitionTextForDisplay(def);
              const expanded = expandedId === rowId;
              return (
                <React.Fragment key={rowId}>
                  <tr className="align-top">
                    <td className="px-3 py-2 align-top text-ink">
                      <div className="font-medium text-ink">{def.defined_term}</div>
                      {provisionText ? (
                        <button
                          type="button"
                          className="term-cell-seetext"
                          aria-expanded={expanded}
                          onClick={() => setExpandedId(expanded ? null : rowId)}
                        >
                          See provision
                        </button>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top text-ink">
                      <span className="whitespace-pre-wrap break-words">{definitionText}</span>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="bg-bg/20" data-testid="definition-full-text-row">
                      <td colSpan={2} className="px-3 py-2 whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight">
                        {provisionText}
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
