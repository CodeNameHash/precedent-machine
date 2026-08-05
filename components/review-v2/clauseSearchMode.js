// Review V2 ("Mergertrace") — shared "search inside clause text" toggle.
//
// Chrome's find-in-page deliberately force-opens any closed <details> that
// contains a match (a dedicated, spec'd browser feature, not a bug — and the
// <details> `toggle` event it fires is explicitly non-cancelable, so there is
// no supported way to detect-and-block that reveal while keeping the element
// a real <details>; `beforematch`, which IS interceptable, only fires for
// `hidden="until-found"` content, a different mechanism <details> doesn't
// use). On a review page with dozens of "See provision" disclosures, an
// ordinary Ctrl+F for a common word force-opens every matching one at once —
// the reported "search explodes the page" bug.
//
// Full-text search across clause language is a real, legitimate lawyer
// workflow, so the fix isn't to make clause text permanently unsearchable —
// it's to make that searchability an explicit choice instead of an ambient
// side effect of an ordinary Ctrl+F:
//   OFF (default): every "See provision" disclosure (see
//     SeeProvisionDisclosure in ProvisionTablePrimitives.jsx) renders its
//     body behind the plain `hidden` attribute — never `hidden="until-
//     found"`, never a <details> — which is invisible to find-in-page with
//     no browser auto-reveal behaviour, exactly like `display: none`.
//     Manual click-to-expand still works per row.
//   ON: disclosures render as real <details open>, so their text becomes
//     ordinary visible content an ordinary Ctrl+F reaches like anything
//     else — no reliance on browser-specific auto-expand at all — and a
//     reader who manually re-collapses one can still have Chrome's native
//     find-in-page reopen it, matching what turning this toggle on implies.
//
// Session-scoped (sessionStorage, not localStorage): a lawyer running a
// string of searches keeps the setting across page navigations for the rest
// of the browser tab's life; a fresh browser session starts back at the safe
// default so nobody is ambushed days later by a setting they forgot they'd
// flipped.
//
// Lives here (not components/review/) to match the existing cross-package
// convention: components/review/primitives/ProvisionTablePrimitives.jsx
// already imports a plain-logic module from review-v2 the same way (see
// provisionIndexHelpers.js), because review-v2 REUSES review/'s components,
// never the other way round.

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'mtx-clause-search-mode';

const listeners = new Set();
let cached = null;

function readStorage() {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Storage unavailable (private browsing, a locked-down environment, ...)
    // — the toggle still works in-memory for the life of this page.
    return false;
  }
}

function getSnapshot() {
  if (cached === null) cached = readStorage();
  return cached;
}

function getServerSnapshot() {
  return false;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setClauseSearchMode(next) {
  const value = Boolean(next);
  if (cached === value) return;
  cached = value;
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    }
  } catch {
    // Same fallback as readStorage(): keep working in-memory this page load.
  }
  listeners.forEach((listener) => listener());
}

// Returns [enabled, setEnabled] — setEnabled accepts either a boolean or a
// useState-style updater function, so callers can do
// setEnabled((current) => !current) exactly as they would with useState.
export function useClauseSearchMode() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setEnabled = (next) => {
    setClauseSearchMode(typeof next === 'function' ? next(getSnapshot()) : next);
  };
  return [enabled, setEnabled];
}
