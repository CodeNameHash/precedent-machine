import { useEffect, useRef } from 'react';

export default function ProcessSourceReader({ reader, onClose, onContextAction }) {
  const dialogRef = useRef(null);
  const priorFocusRef = useRef(null);
  useEffect(() => {
    if (!reader) return undefined;
    priorFocusRef.current = document.activeElement;
    dialogRef.current?.focus();
    return () => priorFocusRef.current?.focus?.();
  }, [reader]);
  useEffect(() => { const close = (event) => { if (event.key === 'Escape') onClose?.(); }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, [onClose]);
  if (!reader) return null;
  return <div className="fixed inset-0 z-50 bg-black/30" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}><aside ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Source reader" className="ml-auto flex h-screen w-full max-w-3xl flex-col bg-white shadow-xl"><header className="flex items-center justify-between border-b border-border p-4"><h2 className="text-base font-medium text-ink">{reader.label || 'Source reader'}</h2><button type="button" onClick={onClose} aria-label="Close source reader" className="text-sm text-inkLight">Close</button></header><div className="flex-1 overflow-y-auto p-4"><pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-ink">{reader.exact_content || reader.content || 'Source content is unavailable.'}</pre></div>{(reader.context_actions || []).length ? <footer className="border-t border-border p-4"><div className="flex flex-wrap gap-2">{reader.context_actions.map((action) => <button key={action.label} type="button" onClick={() => onContextAction?.(action)} className="rounded border border-border px-3 py-2 text-sm text-ink">{action.label}</button>)}</div></footer> : null}</aside></div>;
}
