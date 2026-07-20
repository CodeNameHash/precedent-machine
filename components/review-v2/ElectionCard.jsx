// Review V2 ("Mergertrace") — Election summary card, Consideration section.
// Fed by deriveElectionSummary(reviewDeal) (sectionList.js): the cash/stock
// (or cash/mixed, etc.) option split, each option's economics rendered as
// the SAME green "present" PillCell every cash deal's per-share
// consideration row uses (renderPerShareDetail in consideration-hero.config
// .js), plus the election-mechanics facts as NORMAL table rows beneath.
// NO new extraction — this is a presentation layer over data already on
// the card.
//
// Round 2 (Ben): no "Election" header strip; economics are pills, not mono
// text; the option split IS the card (no separate "economics rows" nested
// under it).
//
// r9 (Ben): deadline/oversubscription collapse to their operative fact —
// derived deterministically from the clause shape, never paraphrased.
//
// r17 (Ben): "the oversubscription rows look generic … lacks see provision
// — can we add that and make them look more like normal table rows?" The
// deadline / oversubscription / caps / no-election facts now render through
// the shared GroupedSubRows primitive — label column, value, the standard
// left-column "See provision" toggle with the full-width expansion carrying
// the verbatim clause (the same seeTextContent contract every other grouped
// table uses). Row building + clause-shape summaries live in
// electionRows.js / consideration-hero.config.js (plain JS, node-testable);
// when no clause shape is confidently detected the row shows NO derived
// sentence — just the verbatim clause behind See provision.
//
// Styled to match every other .mtx table on the page (MergertraceStyles):
// white body, 1px #E0E0E0 borders, sharp corners. Reuses the same
// PillCell/EvidenceHoverSource/GroupedSubRows primitives as every other
// table.

import { PillCell, EvidenceHoverSource, GroupedSubRows } from '../review/primitives/ProvisionTablePrimitives';
import { buildElectionMechanicsRows } from './electionRows';
// Re-exported for back-compat: these lived here through r16 (now shared,
// plain-JS and node-testable in consideration-hero.config.js).
export { summarizeElectionDeadline, summarizeOversubscription } from '../review/table-configs/consideration-hero.config.js';

export default function ElectionCard({ election, onSelectCard, selectedCardId }) {
  if (!election) return null;

  // FIX 4(c): the deal affirmatively states there's no election / no
  // proration (SkyWater/IonQ) -- one quiet line, no options grid, never
  // nothing at all.
  // Item 5 (r6): that quiet line used to be the ONLY thing this card
  // rendered, dropping the actual fixed cash-plus-stock split (SkyWater:
  // $15.00 per share in cash + the Exchange Ratio in Parent stock) a
  // reviewer needs to see immediately. When deriveElectionSummary resolved
  // a fixedSplit (sectionList.js), render it as the SAME green "present"
  // value pills every mixed-consideration deal's split uses, with the
  // no-election/no-proration note demoted to a secondary caption line
  // beneath -- never the whole card.
  if (election.noElection) {
    const split = Array.isArray(election.fixedSplit) ? election.fixedSplit : null;
    return (
      <section data-testid="provision-table-election" className="border border-border bg-white mb-3.5">
        {split ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {split.map((part) => (
              <div key={part.label} className="px-3.5 py-3">
                <p className="text-[11px] font-semibold text-ink mb-1.5">{part.label}</p>
                <PillCell
                  label={part.value}
                  tone="present"
                  evidence={election.evidence}
                  source={part.card || election.sourceCard}
                />
              </div>
            ))}
          </div>
        ) : null}
        <EvidenceHoverSource evidence={election.evidence} source={election.sourceCard} highlight={null} as="p">
          <p className={`px-3.5 py-2.5 text-[11px] text-inkFaint${split ? ' border-t border-border' : ''}`}>Fixed mixed consideration — no election, no proration</p>
        </EvidenceHoverSource>
      </section>
    );
  }

  if (!Array.isArray(election.options) || election.options.length < 2) return null;
  const { options, evidence, sourceCard } = election;

  // r17: caps/deadline/oversubscription/default as GroupedSubRows rows.
  // Caps render as the same info pills they were before, now inside the
  // row's value cell; rows with no confidently-derived sentence show a
  // muted pointer (the verbatim clause is behind See provision) — never a
  // generic line that reads as if it were extracted.
  const mechanicsRows = buildElectionMechanicsRows(election).map((row) => {
    if (Array.isArray(row.caps) && row.caps.length) {
      return {
        ...row,
        children: (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {row.caps.map((cap) => (
              <PillCell
                key={cap.label}
                label={`${cap.label}: ${cap.figure}`}
                tone="info"
                evidence={row.evidence}
                source={row.card}
              />
            ))}
          </span>
        ),
      };
    }
    if (!row.value) {
      return {
        ...row,
        children: <span className="text-[11px] italic text-inkFaint">Full clause text behind “See provision”</span>,
      };
    }
    return row;
  });

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

      {mechanicsRows.length ? (
        <div className="border-t border-border px-2 py-2" data-testid="election-mechanics-rows">
          <GroupedSubRows
            groups={[{ id: 'election-mechanics', label: 'Election mechanics', rows: mechanicsRows }]}
            onSelectCard={onSelectCard}
            resolveCard={onSelectCard ? (row) => row.card || sourceCard || null : undefined}
            selectedCardId={selectedCardId}
          />
        </div>
      ) : null}
    </section>
  );
}
