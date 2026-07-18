// Review V2 ("Mergertrace") — Election summary card, Consideration section.
// Fed by deriveElectionSummary(reviewDeal) (sectionList.js): the cash/stock
// (or cash/mixed, etc.) option split, each option's economics rendered as
// the SAME green "present" PillCell every cash deal's per-share
// consideration row uses (renderPerShareDetail in consideration-hero.config
// .js), plus a single compact caption line folding in the default/no-
// election treatment and the proration note — no separate spanning row.
// NO new extraction — this is a presentation layer over data already on
// the card.
//
// Round 2 (Ben): no "Election" header strip; economics are pills, not mono
// text; the option split IS the card (no separate "economics rows" nested
// under it); proration folds into the one caption line instead of its own
// bordered block.
//
// Styled to match every other .mtx table on the page (MergertraceStyles):
// white body, 1px #E0E0E0 borders, sharp corners. Reuses the same
// PillCell/EvidenceHoverSource primitives as every other table.

import { PillCell, EvidenceHoverSource } from '../review/primitives/ProvisionTablePrimitives';

export default function ElectionCard({ election }) {
  if (!election || !Array.isArray(election.options) || election.options.length < 2) return null;
  const { options, defaultTreatment, isProrated, prorationNote, evidence, sourceCard } = election;

  const caption = [
    defaultTreatment ? <>If no election: treated as <span className="font-medium text-ink">{defaultTreatment}</span></> : null,
    isProrated ? 'subject to proration' : null,
  ].filter(Boolean);

  return (
    <section data-testid="provision-table-election" className="border border-border bg-white mb-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {options.map((option) => (
          <div key={option.label} className="px-3.5 py-3">
            <p className="text-[11px] font-semibold text-ink mb-1.5">{option.label}</p>
            <PillCell
              label={option.economics || 'See source'}
              tone="present"
              evidence={evidence}
              source={sourceCard}
            />
          </div>
        ))}
      </div>

      {caption.length ? (
        <EvidenceHoverSource evidence={prorationNote} source={sourceCard} highlight={null} as="p">
          <p className="border-t border-border px-3.5 py-1.5 text-[10px] text-inkFaint">
            {caption.reduce((acc, part, i) => (i === 0 ? [part] : [...acc, ' · ', part]), [])}
          </p>
        </EvidenceHoverSource>
      ) : null}
    </section>
  );
}
