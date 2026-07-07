import { useEffect } from 'react';

function humanizeFieldKey(key) {
  if (!key) return '';
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function truncateMiddle(text, max = 80) {
  if (!text || text.length <= max) return text || '';
  const head = Math.floor((max - 3) / 2);
  const tail = max - 3 - head;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

export default function AuditCellDrawer({ cell, onClose }) {
  useEffect(() => {
    if (!cell) return undefined;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cell, onClose]);

  if (!cell) return null;

  const excerpt = cell.evidence_quote || cell.source_excerpt || '';
  const sectionLabel = cell.section_anchor || cell.sourceProvisionId || null;
  const humanField = humanizeFieldKey(cell.field);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        data-testid="audit-cell-drawer-backdrop"
        aria-hidden="true"
      />
      <aside
        className="fixed right-0 top-0 z-50 h-screen w-full max-w-md overflow-y-auto border-l border-border bg-white p-6 shadow-xl sm:max-w-lg"
        data-testid="audit-cell-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Audit cell: ${humanField}`}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-display text-lg text-ink">{humanField}</h2>
          <button
            type="button"
            className="text-xs text-inkLight hover:text-ink"
            onClick={onClose}
            aria-label="Close drawer"
          >
            Close (Esc)
          </button>
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-ui text-xs uppercase tracking-wide text-inkFaint">Deal</dt>
            <dd className="mt-1 text-ink">{cell.deal || 'Corpus baseline'}</dd>
          </div>
          <div>
            <dt className="font-ui text-xs uppercase tracking-wide text-inkFaint">Canonical key</dt>
            <dd className="mt-1 text-ink">{cell.canonicalKey || 'Not set'}</dd>
          </div>
          <div>
            <dt className="font-ui text-xs uppercase tracking-wide text-inkFaint">Extractor raw value</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-ink">
              {cell.extractorRawValue || 'Not recovered'}
            </dd>
          </div>
          <div>
            <dt className="font-ui text-xs uppercase tracking-wide text-inkFaint">Source provision</dt>
            <dd className="mt-1 text-ink">
              {sectionLabel || 'Not linked'}
              {cell.sourceProvisionId && cell.section_anchor ? (
                <span className="ml-2 text-xs text-inkFaint" title={cell.sourceProvisionId}>
                  ({truncateMiddle(cell.sourceProvisionId, 16)})
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="font-ui text-xs uppercase tracking-wide text-inkFaint">Evidence excerpt</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words rounded border border-border bg-bg p-3 text-ink">
              {excerpt || <span className="italic text-inkFaint">No excerpt returned</span>}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-border px-3 py-1 text-xs text-inkLight opacity-60"
            disabled
            title="Wiring deferred to WP-AUDIT-ACTIONS-01"
          >
            Approve gap
          </button>
          <button
            type="button"
            className="rounded border border-border px-3 py-1 text-xs text-inkLight opacity-60"
            disabled
            title="Wiring deferred to WP-AUDIT-ACTIONS-01"
          >
            Mark for Phase 1 re-extraction
          </button>
          <button
            type="button"
            className="rounded border border-border px-3 py-1 text-xs text-inkLight opacity-60"
            disabled
            title="Wiring deferred to WP-AUDIT-ACTIONS-01"
          >
            Fix inline
          </button>
          <button
            type="button"
            className="rounded border border-border px-3 py-1 text-xs text-inkLight opacity-60"
            disabled
            title="Wiring deferred to WP-AUDIT-ACTIONS-01"
          >
            Open source
          </button>
        </div>
      </aside>
    </>
  );
}
