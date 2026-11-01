// How common one coded answer is across the reference set (work package 55,
// note DEEPSEEK-NAV-INDEX-COMPARE-2026-11-01). The denominator is the runs
// that answer the row, never the whole corpus: a run that does not state the
// provision is "not stated", which is not a "No" and is never folded into a
// negative. The component is presentational; the API supplies `distribution`
// (lib/product/comparison-tables.js howCommonFromConclusions).
//
// Two shapes: `cell` for a comparison grid's right-hand column (top three
// answers, compact) and `panel` for a table header (every answer).

const BAR_COLOURS = ['#03203D', '#0B3D71', '#5D7DA3', '#B9C8DA'];

function percent(share) {
  const value = Number(share);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(2, Math.round(value * 100));
}

function answerLabel(entry) {
  return String(entry?.value || '').trim() || 'Unlabelled answer';
}

export default function HowCommon({
  distribution = null,
  variant = 'cell',
  title = 'How common',
  showTitle = true,
  emptyLabel = 'No coded answer in the reference set.',
  className = '',
}) {
  const answered = Number(distribution?.answered || 0);
  const runsTotal = Number(distribution?.runs_total || 0);
  const entries = Array.isArray(distribution?.entries) ? distribution.entries : [];
  const notStated = Number.isFinite(Number(distribution?.not_stated))
    ? Number(distribution.not_stated)
    : Math.max(0, runsTotal - answered);
  const shown = variant === 'panel' ? entries : entries.slice(0, 3);
  const hidden = Math.max(0, entries.length - shown.length);

  if (!distribution) {
    return (
      <div className={`text-[10px] font-ui leading-snug text-[#6B7785] ${className}`} data-testid="how-common" data-variant={variant}>
        How common is not available for this row.
      </div>
    );
  }

  return (
    <figure className={`m-0 ${className}`} data-testid="how-common" data-variant={variant} aria-label={`${title}: ${answered} of ${runsTotal} runs answer`}>
      {showTitle ? (
        <figcaption className="mb-[4px] text-[9px] font-ui font-semibold uppercase tracking-[0.1em] text-[#6B7785]">
          {title}
          <span className="ml-[5px] font-normal normal-case tracking-normal text-[#6B7785]">
            {answered > 0 ? `${answered} of ${runsTotal} runs answer` : `0 of ${runsTotal} runs answer`}
          </span>
        </figcaption>
      ) : (
        <p className="m-0 mb-[4px] font-ui text-[9px] text-[#6B7785]">{answered} of {runsTotal} runs answer</p>
      )}
      {answered === 0 ? (
        <p className="m-0 text-[10px] font-body leading-snug text-[#6B7785]">{emptyLabel}</p>
      ) : (
        <ul className="m-0 list-none space-y-[4px] p-0">
          {shown.map((entry, index) => {
            const count = Number(entry?.count || 0);
            const share = answered > 0 ? count / answered : 0;
            return (
              <li key={`${answerLabel(entry)}-${index}`} data-testid="how-common-entry" className="m-0">
                <div className="flex items-baseline justify-between gap-[6px]">
                  <span className="min-w-0 truncate font-ui text-[10.5px] font-medium text-[#33475E]" title={answerLabel(entry)}>{answerLabel(entry)}</span>
                  <span className="shrink-0 font-ui text-[10px] tabular-nums text-[#03203D]">{count} of {answered}</span>
                </div>
                <div className="mt-[2px] h-[3px] w-full bg-[#F1F4F8]" role="img" aria-label={`${answerLabel(entry)} ${Math.round(share * 100)} percent`}>
                  <div className="h-[3px]" style={{ width: `${percent(share)}%`, backgroundColor: BAR_COLOURS[index % BAR_COLOURS.length] }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 ? <p className="m-0 mt-[3px] text-[9.5px] font-ui text-[#6B7785]">+{hidden} other answer{hidden === 1 ? '' : 's'}</p> : null}
      {notStated > 0 ? (
        <p className="m-0 mt-[4px] text-[9.5px] font-body leading-snug text-[#6B7785]">
          Not stated in {notStated} — not a “No”.
        </p>
      ) : null}
    </figure>
  );
}
