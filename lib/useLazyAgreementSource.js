import { useCallback, useEffect, useRef, useState } from 'react';

// Q4 (perf quick-wins, Jul 2026): /api/agreement-source ships the deal's
// ENTIRE agreement full_text (hundreds of KB, often MBs) and was fetched
// eagerly on mount (pages/review/[id].js:155-161, pre-perf-package) even
// though most review sessions never open the source overlay or "Full
// Merger Agreement" view. Defer the fetch to requestIdleCallback — after
// the provision tables have painted — but still fetch it immediately
// on-demand (`ensureLoaded()`) if the overlay/agreement view is opened
// before idle has fired, so it's never permanently unavailable.
//
// `attempted` distinguishes "haven't fetched yet" (optimistic — assume the
// deal HAS source text) from "fetched and there genuinely is none" (the
// deal-header "no source text" affordance), so callers can gate UI
// correctly without forcing an eager fetch just to know the answer.
export function useLazyAgreementSource(dealId) {
  const [agreementSource, setAgreementSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const fetchedRef = useRef(false);
  const dealIdRef = useRef(dealId);
  dealIdRef.current = dealId;

  const load = useCallback((id) => {
    if (!id || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    fetch(`/api/agreement-source?deal_id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => setAgreementSource(d.agreement_source || null))
      .catch(() => setAgreementSource(null))
      .finally(() => {
        setLoading(false);
        setAttempted(true);
      });
  }, []);

  useEffect(() => {
    fetchedRef.current = false;
    setAgreementSource(null);
    setLoading(false);
    setAttempted(false);
    if (!dealId || typeof window === 'undefined') return undefined;

    const ric = window.requestIdleCallback
      || ((cb) => setTimeout(() => cb({ didTimeout: true }), 1500));
    const cic = window.cancelIdleCallback || window.clearTimeout;
    const handle = ric(() => load(dealId));
    return () => cic(handle);
  }, [dealId, load]);

  const ensureLoaded = useCallback(() => load(dealIdRef.current), [load]);

  return { agreementSource, loading, attempted, ensureLoaded };
}
