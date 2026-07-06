const STYLES = {
  REQUIRES_REVIEWER_DECISION: 'border-seller/20 bg-seller/10 text-seller',
  PENDING_REVIEW: 'border-amber-200 bg-amber-50 text-amber-800',
  APPROVED: 'border-buyer/20 bg-buyer/10 text-buyer',
  REJECTED: 'border-seller/20 bg-seller/10 text-seller',
  MERGED: 'border-accent/20 bg-accent/10 text-accent',
  RENAMED: 'border-accent/20 bg-accent/10 text-accent',
  DEFERRED: 'border-border bg-bg text-inkLight',
  FROZEN: 'border-buyer/20 bg-buyer/10 text-buyer',
};

function labelOf(value) {
  return String(value || 'PENDING_REVIEW').replace(/_/g, ' ');
}

export default function FlagBadge({ value, tone }) {
  const key = value || tone || 'PENDING_REVIEW';
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-ui font-semibold uppercase tracking-wide ${STYLES[key] || STYLES.PENDING_REVIEW}`}>
      {labelOf(key)}
    </span>
  );
}
