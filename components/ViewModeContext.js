import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

const STORAGE_KEY = 'recital.viewMode';

/*
 * Edit view vs. User view.
 *
 * EDITORS (Ben) see everything: edit affordances, correction/save controls,
 * and pipeline/QA internals (coverage %, quote verification, extraction
 * status, re-extract/re-classify controls, trust reports).
 *
 * USERS get a read-only research tool: full provisions, tables, source
 * evidence (hovers, click-to-source, full-document view), definitions,
 * search, sidebar navigation — but no editing and none of the pipeline/QA
 * internals above.
 *
 * IMPORTANT: this is a UX split, not a security boundary. There is no auth
 * check behind `isEdit` — anyone can flip to edit mode via the header
 * toggle, localStorage, or a `?mode=edit` URL param. Do not use this context
 * to gate anything that actually needs to be protected; that requires a real
 * server-side check.
 */

const ViewModeContext = createContext({
  viewMode: 'user',
  isEdit: false,
  setViewMode: () => {},
});

export function ViewModeProvider({ children }) {
  const router = useRouter();
  const [viewMode, setViewModeState] = useState('user');

  // Hydrate from localStorage on mount (default 'user' on the server and on
  // first client render avoids a hydration mismatch — the swap happens in
  // this effect, after mount).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'edit' || stored === 'user') setViewModeState(stored);
    } catch {
      // localStorage unavailable (private mode, SSR edge case) — stay on default.
    }
  }, []);

  const setViewMode = useCallback((mode) => {
    const next = mode === 'edit' ? 'edit' : 'user';
    setViewModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — persistence is best-effort
    }
  }, []);

  // ?mode=edit / ?mode=user query override — applied whenever it's present,
  // and persisted so it sticks after the param is gone.
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query?.mode;
    if (q === 'edit' || q === 'user') setViewMode(q);
  }, [router.isReady, router.query?.mode, setViewMode]);

  const value = useMemo(
    () => ({ viewMode, isEdit: viewMode === 'edit', setViewMode }),
    [viewMode, setViewMode]
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode() {
  return useContext(ViewModeContext);
}

/* Small, subtle header control. Users are the default audience — this should
   never read as a prominent admin switch. */
export function ViewModeToggle({ className = '' }) {
  const { isEdit, setViewMode } = useViewMode();
  return (
    <button
      type="button"
      onClick={() => setViewMode(isEdit ? 'user' : 'edit')}
      title={isEdit ? 'Editing enabled — click to switch to the read-only user view' : 'Read-only user view — click to enable editing'}
      className={`rec-viewmode-toggle${isEdit ? ' is-edit' : ''} ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontFamily: 'var(--font-mono, inherit)',
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        color: isEdit ? 'var(--accent-deep, #7a5a2f)' : 'var(--ink-faint, #9a968f)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 2px',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 24,
          height: 13,
          borderRadius: 7,
          background: isEdit ? 'var(--accent, #b5852f)' : 'var(--line, #d8d5cf)',
          position: 'relative',
          transition: 'background 120ms ease',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 1.5,
            left: isEdit ? 12 : 1.5,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 120ms ease',
          }}
        />
      </span>
      Edit mode
    </button>
  );
}
