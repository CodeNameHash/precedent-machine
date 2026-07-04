import { employeeBenefitsDisplayState } from '../../lib/employee-benefits';
import { HoverSource, Pill, REVIEW_LABEL_COL_W } from './shared';
import { TermCell } from './TermCell';

function EmptyCell() {
  return <span className="italic text-inkFaint">Not extracted</span>;
}

// FB3 missed item 1 — each element row shows its STANDARD and COMPARISON
// GROUP as pills (never invented; comparisonGroup is null for a non-
// comparative standard like buyer discretion, in which case only the
// standard pill renders). Bundled rows (owner's principle: a benefit
// bundled into another element's clause still gets its OWN row) share the
// SAME quote as the entry they were bundled from — a shared hover.
function ElementValueCell({ row }) {
  if (!row.standardLabel && !row.comparisonGroup) return <EmptyCell />;
  return (
    <HoverSource quote={row.quote} as="div">
      <div className="flex flex-wrap gap-1.5">
        {row.standardLabel ? <Pill text={row.standardLabel} quote={row.quote} tone="standard" /> : null}
        {row.comparisonGroup ? <Pill text={row.comparisonGroup} quote={row.quote} tone="person" /> : null}
      </div>
    </HoverSource>
  );
}

/* ─── Employee Benefits — new dedicated section (FB3 missed item 1) ──
 *  Registered exactly like SecMeetingTable: a synthetic '__EMPLOYEE_BENEFITS'
 *  sidebar page, placed immediately BEFORE "Other Covenants" (see
 *  components/review/shared.js SIDEBAR_GROUPS + pages/review/[id].js
 *  sentinel synthesis / render branch). Source: COV-EMPLOYEE provisions
 *  (lib/rubric.js) via lib/employee-benefits.js (pure, unit-tested). */
export function EmployeeBenefitsTable({ allProvisions }) {
  const state = employeeBenefitsDisplayState(allProvisions);

  if (state.collapsed) {
    return (
      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-3 py-2 text-xs font-ui italic text-inkFaint">
          {state.collapsedText}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          Employee Benefits
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className={`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`}>Element</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Standard / Comparison Group</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {state.continuationPeriod && (
              <tr className="align-top">
                <td className="px-3 py-2 whitespace-normal break-words">
                  <TermCell provision={state.continuationPeriod.provision} quote={state.continuationPeriod.quote}>
                    <span className="text-ink font-medium">Continuation period</span>
                  </TermCell>
                </td>
                <td className="px-3 py-2 text-ink">
                  <HoverSource quote={state.continuationPeriod.quote} as="div">
                    <span>{state.continuationPeriod.value}</span>
                  </HoverSource>
                </td>
              </tr>
            )}
            {state.rows.map((row) => (
              <tr key={row.code} className="align-top">
                <td className="px-3 py-2 whitespace-normal break-words">
                  <TermCell provision={row.provision} quote={row.quote}>
                    <span className="text-ink font-medium">{row.label}</span>
                  </TermCell>
                </td>
                <td className="px-3 py-2 text-ink">
                  <ElementValueCell row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
