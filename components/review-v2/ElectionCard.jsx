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
  if (!election) return null;

  // FIX 4(c): the deal affirmatively states there's no election / no
  // proration (SkyWater/IonQ) -- one quiet line, no options grid, never
  // nothing at all.
  if (election.noElection) {
    return (
      <section data-testid="provision-table-election" className="border border-border bg-white mb-3.5">
        <EvidenceHoverSource evidence={election.evidence} source={election.sourceCard} highlight={null} as="p">
          <p className="px-3.5 py-2.5 text-[11px] text-inkFaint">Fixed mixed consideration — no election, no proration</p>
        </EvidenceHoverSource>
      </section>
    );
  }

  if (!Array.isArray(election.options) || election.options.length < 2) return null;
  const {
    options, defaultTreatment, isProrated, prorationNote, evidence, sourceCard,
    caps, electionDeadline, oversubscriptionTreatment,
  } = election;

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

      {/* FIX 4(b): structured proration detail -- caps as pills, deadline
          and oversubscription treatment as short lines -- replacing the
          bare "subject to proration" flag with what the cap/deadline/
          oversubscription text actually says. No header row, no duplicate
          rows: pills + text, same .mtx idiom as the rest of the card. */}
      {Array.isArray(caps) && caps.length ? (
        <div className="border-t border-border px-3.5 py-2 flex flex-wrap gap-1.5">
          {caps.map((cap) => (
            <PillCell
              key={cap.label}
              label={`${cap.label}: ${cap.figure}`}
              tone="info"
              evidence={prorationNote || evidence}
              source={sourceCard}
            />
          ))}
        </div>
      ) : null}

      {electionDeadline ? (
        <EvidenceHoverSource evidence={electionDeadline} source={sourceCard} highlight={null} as="p">
          <p className="border-t border-border px-3.5 py-1.5 text-[10px] text-inkFaint">
            <span className="font-medium text-ink">Election deadline: </span>{electionDeadline}
          </p>
        </EvidenceHoverSource>
      ) : null}

      {oversubscriptionTreatment ? (
        <EvidenceHoverSource evidence={oversubscriptionTreatment} source={sourceCard} highlight={null} as="p">
          <p className="border-t border-border px-3.5 py-1.5 text-[10px] text-inkFaint">
            <span className="font-medium text-ink">Oversubscription: </span>{oversubscriptionTreatment}
          </p>
        </EvidenceHoverSource>
      ) : null}

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
