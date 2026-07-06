import { deriveAbrySummary } from '../../lib/abry';
import { useShowEvidence, HoverSource, Pill, REVIEW_LABEL_COL_W } from './shared';
import { TermCell } from './TermCell';

/* ─── No Other Reps / Fraud / Willful Breach (Abry) summary ──
 *  THE FOUR QUESTIONS (one row each, per side) + a fraud line — the entire
 *  point of this section (see lib/abry.js header for the full mapping):
 *    Q1  Buyer's non-reliance representation
 *    Q2  Seller's no-other-reps statement + scope
 *    Q3  Reciprocal — seller's non-reliance representation
 *    Q4  Reciprocal — buyer's no-other-reps statement + scope
 *    Fraud  Verbatim carve-out, or "Silent on fraud" (silence is legally
 *           meaningful — never inferred).
 *
 *  Sourced from ANY provision carrying the five Abry fields — a titled
 *  section (REP-T-NOREP / REP-B-NOREP / REP-B-ANTIRELIANCE) or a MISC-ENTIRE
 *  "Entire Agreement" section with the language embedded in its body
 *  (Metsera §9.07 pattern). This is the ONE place these four questions are
 *  answered in the review UI — replaces the old REP-B "Anti-Reliance / No
 *  Other Reps" checklist placeholder line.
 *
 *  Table-design contract (matching RepGeneralExceptionsTable / NosolFourTables):
 *  the cell shows the DERIVED short answer (Yes / scope label / the fraud
 *  text itself); the full verbatim quote is reachable via hover + click-to-
 *  source, never dumped inline as a second copy of the same text.
 */
function YesNotPresentCell({ hit, scopeLabel }) {
  const showEvidence = useShowEvidence();
  if (!hit || hit.status !== 'yes') {
    return <span className="italic text-inkFaint">Not present in this agreement</span>;
  }
  const quote = hit.quote || null;
  return (
    <div className="flex flex-col gap-1 items-start">
      <Pill text="Yes" quote={quote} tone="amount" />
      {scopeLabel && (
        <HoverSource quote={quote} as="div">
          <span
            className={`text-[11px] text-inkMid ${quote && showEvidence ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
            onClick={quote && showEvidence ? () => showEvidence(quote) : undefined}
          >
            Scope: {scopeLabel}
          </span>
        </HoverSource>
      )}
    </div>
  );
}

function FraudCell({ fraud }) {
  const showEvidence = useShowEvidence();
  if (!fraud || fraud.status !== 'present') {
    return <span className="italic text-inkFaint">Silent on fraud</span>;
  }
  const quote = fraud.quote;
  return (
    <HoverSource quote={quote} as="div">
      <span
        className={`whitespace-pre-wrap break-words ${showEvidence ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
        onClick={showEvidence ? () => showEvidence(quote) : undefined}
      >
        {quote}
      </span>
    </HoverSource>
  );
}

// FB3 missed item 5: single home for Willful Breach — this row replaces the
// old "Willful Breach" group that used to live on the Misc/Boilerplate table
// (removed there; see pages/review/[id].js MiscSummaryTable). Sourced from
// ANY provision carrying `willfulBreachDefinition` (DEF or MISC — see
// lib/abry.js firstWillfulBreachDefinition), verbatim hover, "Not defined"
// when the deal has no such clause.
function WillfulBreachCell({ willfulBreach }) {
  const showEvidence = useShowEvidence();
  if (!willfulBreach || willfulBreach.status !== 'defined') {
    return <span className="italic text-inkFaint">Not defined</span>;
  }
  const quote = willfulBreach.quote;
  return (
    <HoverSource quote={quote} as="div">
      <span
        className={`whitespace-pre-wrap break-words ${showEvidence ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
        onClick={showEvidence ? () => showEvidence(quote) : undefined}
      >
        {quote}
      </span>
    </HoverSource>
  );
}

const ROWS = [
  {
    key: 'q1',
    label: "Buyer's Non-Reliance Representation",
    hasScope: false,
  },
  {
    key: 'q2',
    label: "Seller's No-Other-Reps Statement",
    hasScope: true,
  },
  {
    key: 'q3',
    label: "Seller's Non-Reliance Representation (Reciprocal)",
    hasScope: false,
  },
  {
    key: 'q4',
    label: "Buyer's No-Other-Reps Statement (Reciprocal)",
    hasScope: true,
  },
];

export function NoOtherRepsFraudTable({ allProvisions }) {
  const summary = deriveAbrySummary(allProvisions);

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          No Other Reps / Fraud / Willful Breach (Abry)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className={`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`}>Term</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Provision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ROWS.map((row) => {
              const hit = summary[row.key];
              return (
                <tr key={row.key} className="align-top">
                  <td className={`px-3 py-2 whitespace-normal break-words ${REVIEW_LABEL_COL_W}`}>
                    <TermCell provision={hit && hit.provision} quote={hit && hit.quote}>
                      <span className="text-ink font-medium">{row.label}</span>
                    </TermCell>
                  </td>
                  <td className="px-3 py-2 text-ink">
                    <YesNotPresentCell hit={hit} scopeLabel={row.hasScope ? hit.scope : null} />
                  </td>
                </tr>
              );
            })}
            <tr className="align-top bg-bg/30">
              <td className={`px-3 py-2 whitespace-normal break-words ${REVIEW_LABEL_COL_W}`}>
                <TermCell provision={summary.fraud && summary.fraud.provision} quote={summary.fraud && summary.fraud.quote}>
                  <span className="text-ink font-medium">Fraud Carve-Out</span>
                </TermCell>
              </td>
              <td className="px-3 py-2 text-ink">
                <FraudCell fraud={summary.fraud} />
              </td>
            </tr>
            <tr className="align-top bg-bg/30">
              <td className={`px-3 py-2 whitespace-normal break-words ${REVIEW_LABEL_COL_W}`}>
                <TermCell provision={summary.willfulBreach && summary.willfulBreach.provision} quote={summary.willfulBreach && summary.willfulBreach.quote}>
                  <span className="text-ink font-medium">Willful Breach</span>
                </TermCell>
              </td>
              <td className="px-3 py-2 text-ink">
                <WillfulBreachCell willfulBreach={summary.willfulBreach} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
