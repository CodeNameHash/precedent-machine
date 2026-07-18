// Review V2 ("Mergertrace") — Closing timing summary, Structure & Mechanics
// section. Ben: "closing timing stuff isn't summarized." Renders the rows
// deriveClosingTimingSummary(reviewDeal) (sectionList.js) computes off cards
// already on the deal — Outside Date (+ extension), Marketing Period /
// Ticking Fee when coded, Closing mechanics. NO new extraction. Rows that
// don't apply to a deal are simply absent from the derived array (omitted
// silently, per spec).
//
// Same bordered-card look as every other .mtx summary table (MaeSection):
// grey title strip, white body, 1px border rows.

import { ClampedWithSeeText } from '../review/primitives/ProvisionTablePrimitives';

export default function ClosingTimingSummary({ rows }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return (
    <section data-testid="provision-table-closing-timing" className="border border-border bg-white mb-3.5">
      <div className="border-b border-border bg-paper2 px-3 py-1.5">
        <p>Closing timing</p>
      </div>
      <table className="min-w-full text-xs font-ui">
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="px-3 py-2 w-[12rem] font-medium text-inkFaint">{row.label}</td>
              <td className="px-3 py-2 text-ink">
                <ClampedWithSeeText text={row.value} evidence={row.evidence} source={row.sourceCard} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
