// Review V2 ("Mergertrace") — Election summary card, Consideration section.
// Fed by deriveElectionSummary(reviewDeal) (sectionList.js): two option
// columns (label + per-share/per-option economics in mono, straight off the
// CONSID card's already-extracted features and quoted text) plus a footer
// row for the default/no-election treatment and proration note. NO new
// extraction — this is a presentation layer over data already on the card.
//
// Styled to match every other .mtx table on the page (MergertraceStyles):
// grey #F6F6F6 header strip, white body, 1px #E0E0E0 borders, sharp corners.
// Reuses the same EvidenceHoverSource hover-quote affordance as MaeSection.

import { EvidenceHoverSource } from '../review/primitives/ProvisionTablePrimitives';

export default function ElectionCard({ election }) {
  if (!election || !Array.isArray(election.options) || election.options.length < 2) return null;
  const { options, defaultTreatment, isProrated, prorationNote, evidence, sourceCard } = election;

  return (
    <section data-testid="provision-table-election" className="border border-border bg-white mb-3.5">
      <div className="border-b border-border bg-paper2 px-3 py-1.5">
        <p>Election</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2">
        {options.map((option, index) => (
          <div
            key={option.label}
            className={`px-3.5 py-3 ${index > 0 ? 'sm:border-l border-t sm:border-t-0 border-border' : ''}`}
          >
            <p className="text-[11px] font-semibold text-ink">{option.label}</p>
            <EvidenceHoverSource evidence={evidence} source={sourceCard} highlight={null} as="p">
              <p className="mtx-mono mt-1 text-sm text-ink">
                {option.economics || 'See source'}
              </p>
            </EvidenceHoverSource>
          </div>
        ))}
      </div>

      {(defaultTreatment || isProrated) && (
        <div className="border-t border-border bg-paper2 px-3.5 py-2 space-y-1">
          {defaultTreatment ? (
            <p className="text-[11px] text-inkLight">
              If no election: treated as <span className="font-medium text-ink">{defaultTreatment}</span>
            </p>
          ) : null}
          {isProrated ? (
            <EvidenceHoverSource evidence={prorationNote} source={sourceCard} highlight={null} as="p">
              <p className="text-[11px] text-inkLight">
                Subject to proration
                {prorationNote ? <span className="text-inkFaint"> — see proration mechanics</span> : null}
              </p>
            </EvidenceHoverSource>
          ) : null}
        </div>
      )}
    </section>
  );
}
