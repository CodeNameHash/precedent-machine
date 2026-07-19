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

// Ben r9: "election deadline should just say 5 BDs after company
// stockholder meeting" — collapse the boilerplate timing clause to its one
// operative fact. Deterministic parse; the full verbatim stays on hover
// (EvidenceHoverSource) so nothing is lost. Falls back to the raw text
// whenever the pattern doesn't match.
const WORD_NUMS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
export function summarizeElectionDeadline(text) {
  const t = String(text || '');
  const m = t.match(/(?:(\w+)\s*)?\((\d+)\)\s*business days?\s*(prior to|before|after|following)\s*(?:the date of\s*)?the\s+([A-Z][\w\s]*?(?:Meeting|Effective Time|Closing))/i)
    || t.match(/(\w+|\d+)\s*business days?\s*(?:()|)(prior to|before|after|following)\s*(?:the date of\s*)?the\s+([A-Z][\w\s]*?(?:Meeting|Effective Time|Closing))/i);
  if (!m) return t;
  const parts = m.slice(1).filter((x) => x !== undefined);
  const numRaw = parts[0];
  const num = /^\d+$/.test(numRaw) ? numRaw : (parts[1] && /^\d+$/.test(parts[1]) ? parts[1] : WORD_NUMS[String(numRaw).toLowerCase()] || numRaw);
  const rel = parts.find((x) => /prior to|before|after|following/i.test(x)) || 'before';
  const anchor = parts[parts.length - 1].trim();
  return `${num} business days ${/prior|before/i.test(rel) ? 'before' : 'after'} the ${anchor}`;
}

// Ben r9: "oversubscription should be clear how that works — not just
// produce the text." The standard mechanics: if one side's elections
// exceed its cap, the other side gets its chosen form in full and the
// oversubscribed side is prorated back to the cap. Detected from the
// clause shape; raw text on hover; falls back to the verbatim when the
// clause doesn't match the standard shape.
export function summarizeOversubscription(text) {
  const t = String(text || '');
  const cashOver = /Cash Election Shares exceeds the Maximum Cash/i.test(t);
  const stockOver = /Stock Election Shares exceeds the Maximum Stock/i.test(t);
  if (cashOver && stockOver) {
    return 'If either side is oversubscribed, the undersubscribed side receives its chosen form in full and the oversubscribed elections are prorated back to the cap (part paid in the other form).';
  }
  if (cashOver) return 'If cash elections exceed the cap, stock elections are honored in full and cash elections are prorated back to the cap.';
  if (stockOver) return 'If stock elections exceed the cap, cash elections are honored in full and stock elections are prorated back to the cap.';
  return t;
}

export default function ElectionCard({ election }) {
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
            <span className="font-medium text-ink">Election deadline: </span>{summarizeElectionDeadline(electionDeadline)}
          </p>
        </EvidenceHoverSource>
      ) : null}

      {oversubscriptionTreatment ? (
        <EvidenceHoverSource evidence={oversubscriptionTreatment} source={sourceCard} highlight={null} as="p">
          <p className="border-t border-border px-3.5 py-1.5 text-[10px] text-inkFaint">
            <span className="font-medium text-ink">Oversubscription: </span>{summarizeOversubscription(oversubscriptionTreatment)}
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
