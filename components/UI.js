/* Skeleton Loaders */
export function SkeletonLine({ className = '' }) {
  return <div className={`h-4 bg-border/60 rounded animate-pulse ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-border rounded-lg shadow-sm p-6 space-y-3 animate-pulse">
      <div className="h-5 bg-border/60 rounded w-1/3" />
      <div className="h-4 bg-border/40 rounded w-full" />
      <div className="h-4 bg-border/40 rounded w-4/5" />
      <div className="h-4 bg-border/40 rounded w-2/3" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="border-b border-border bg-bg/50 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-border/60 rounded w-24 animate-pulse" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="border-b border-border last:border-0 px-4 py-3 flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-4 bg-border/40 rounded w-20 animate-pulse" style={{ width: `${60 + Math.random() * 60}px` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* Empty State */
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="bg-white border border-border rounded-lg shadow-sm p-12 text-center">
      {icon && <div className="text-4xl mb-3 opacity-30">{icon}</div>}
      <h3 className="font-display text-lg text-ink mb-1">{title}</h3>
      {description && <p className="text-sm text-inkLight font-ui mb-4">{description}</p>}
      {action}
    </div>
  );
}

/* Error State */
export function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-white border border-seller/20 rounded-lg shadow-sm p-8 text-center">
      <div className="text-3xl mb-3">⚠</div>
      <h3 className="font-display text-lg text-seller mb-1">Something went wrong</h3>
      <p className="text-sm text-inkLight font-ui mb-4">{message || 'An unexpected error occurred.'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

/* Breadcrumbs */
export function Breadcrumbs({ items }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs font-ui text-inkFaint mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-inkFaint/50">›</span>}
          {item.href ? (
            <a href={item.href} className="hover:text-ink transition-colors">{item.label}</a>
          ) : (
            <span className="text-inkMid">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* AI Badge */
export function AIBadge({ verified, verifierName, className = '' }) {
  if (verified) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-ui font-medium bg-buyer/10 text-buyer ring-1 ring-buyer/30 ${className}`}>
        AI ✓ {verifierName || 'verified'}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-ui font-medium bg-gray-100 text-inkFaint border border-dashed border-inkFaint/40 ${className}`}>
      AI generated
    </span>
  );
}
