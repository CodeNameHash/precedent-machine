import {
  enumLabel,
  formatAdjournmentLimits,
  formatDeadline,
  humanizeCode,
  secMeetingDisplayState,
} from '../../lib/sec-meeting';
import { HoverSource, Pill, REVIEW_LABEL_COL_W } from './shared';

function EmptyCell() {
  return <span className="italic text-inkFaint">Not extracted</span>;
}

function DeadlineCell({ deadline }) {
  if (!deadline) return <EmptyCell />;
  const quote = deadline.text || null;
  if (typeof deadline.days !== 'number') {
    const text = formatDeadline(deadline);
    return text ? (
      <HoverSource quote={quote} as="span">
        <span className="whitespace-pre-wrap break-words">{text}</span>
      </HoverSource>
    ) : <EmptyCell />;
  }
  return (
    <HoverSource quote={quote} as="div" className="flex flex-wrap items-center gap-1.5">
      <span className="font-medium text-ink">{deadline.days}</span>
      {deadline.unit ? <Pill text={enumLabel(deadline.unit)} quote={quote} tone="amount" /> : <span className="text-inkMid">days</span>}
      {deadline.trigger ? (
        <>
          <span className="text-inkFaint">after</span>
          <Pill text={enumLabel(deadline.trigger)} quote={quote} />
        </>
      ) : null}
    </HoverSource>
  );
}

function ReasonPills({ reasons, quote }) {
  if (!Array.isArray(reasons) || reasons.length === 0) {
    return <span className="italic text-inkFaint">No enumerated reason extracted</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {reasons.map((reason, idx) => (
        <Pill
          key={`${reason.code || reason.label || 'reason'}-${idx}`}
          text={reason.label || humanizeCode(reason.code)}
          quote={reason.text || quote}
        />
      ))}
    </div>
  );
}

function AdjournmentCell({ right }) {
  if (!right) return <EmptyCell />;
  const quote = right.text || null;
  const limits = formatAdjournmentLimits(right);
  return (
    <HoverSource quote={quote} as="div" className="space-y-1">
      <ReasonPills reasons={right.reasons} quote={quote} />
      <div className="flex flex-wrap gap-1.5">
        {right.party ? <Pill text={enumLabel(right.party)} quote={quote} tone="person" /> : null}
        {limits.length > 0 ? (
          limits.map((limit) => <Pill key={limit} text={limit} quote={quote} tone="amount" />)
        ) : (
          <span className="text-[11px] italic text-inkFaint">No stated numeric cap</span>
        )}
      </div>
    </HoverSource>
  );
}

function TextCell({ text }) {
  if (!text) return <EmptyCell />;
  return (
    <HoverSource quote={text} as="span">
      <span className="whitespace-pre-wrap break-words">{text}</span>
    </HoverSource>
  );
}

function ValueCell({ row }) {
  if (row.kind === 'deadline') return <DeadlineCell deadline={row.value} />;
  if (row.kind === 'adjournment') return <AdjournmentCell right={row.value} />;
  if (row.kind === 'text') return <TextCell text={row.value} />;
  return <EmptyCell />;
}

export function SecMeetingTable({ allProvisions }) {
  const state = secMeetingDisplayState(allProvisions);

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
          SEC Filing / Meeting Requirements
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
            {state.rows.map((row) => (
              <tr key={row.key} className="align-top">
                <td className={`px-3 py-2 whitespace-normal break-words ${REVIEW_LABEL_COL_W}`}>
                  <span className="text-ink font-medium">{row.label}</span>
                </td>
                <td className="px-3 py-2 text-ink">
                  <ValueCell row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
