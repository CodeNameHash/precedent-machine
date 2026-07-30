import { useEffect, useRef } from 'react';

function ReaderContent({ reader, onClose, onContextAction, desktop = false }) {
  return <>
    <header className="flex items-center justify-between border-b border-border p-4"><h2 className="text-base font-medium text-ink">{reader.label || 'Source reader'}</h2>{onClose ? <button type="button" onClick={onClose} aria-label="Close source reader" className="text-sm text-inkLight">Close</button> : null}</header>
    <div className="flex-1 overflow-y-auto p-4"><pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-ink">{reader.exact_content || reader.content || 'Source content is unavailable.'}</pre></div>
    {(reader.context_actions || []).length ? <footer className="border-t border-border p-4"><div className="flex flex-wrap gap-2">{reader.context_actions.map((action) => <button key={action.label} type="button" onClick={() => onContextAction?.(action)} className="rounded border border-border px-3 py-2 text-sm text-ink">{action.label}</button>)}</div></footer> : null}
  </>;
}

export default function ProcessSourceReader({ reader, desktopPane = false, onClose, onContextAction }) {
  const dialogRef = useRef(null);
  const priorFocusRef = useRef(null);
  useEffect(() => {
    const desktop = desktopPane && window.matchMedia('(min-width: 1024px)').matches;
    if (!reader || desktop) return undefined;
    priorFocusRef.current = document.activeElement;
    dialogRef.current?.focus();
    return () => priorFocusRef.current?.focus?.();
  }, [desktopPane, reader]);
  useEffect(() => { const close = (event) => { if (event.key === 'Escape') onClose?.(); }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, [onClose]);
  if (!reader) return null;
  if (!desktopPane) return <div className="fixed inset-0 z-50 bg-black/30" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}><aside ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Source reader" className="ml-auto flex h-screen w-full max-w-3xl flex-col bg-white shadow-xl"><ReaderContent reader={reader} onClose={onClose} onContextAction={onContextAction} /></aside></div>;
  return <><aside aria-label="Source reader" className="hidden lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-2rem)] lg:flex-col lg:overflow-hidden lg:rounded lg:border lg:border-border lg:bg-white lg:shadow-sm"><ReaderContent reader={reader} onClose={onClose} onContextAction={onContextAction} desktop /></aside><div className="fixed inset-0 z-50 bg-black/30 lg:hidden" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}><aside ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Source reader" className="ml-auto flex h-screen w-full max-w-3xl flex-col bg-white shadow-xl"><ReaderContent reader={reader} onClose={onClose} onContextAction={onContextAction} /></aside></div></>;
}
