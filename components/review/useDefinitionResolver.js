// PERF REGRESSION FIX (Jul 2026, post-review): resolvedReferences (the
// definitions a cross-reference card cites, with their full text) is
// hover-preview content ONLY — see lib/queries/reconstruct-review-deal.js's
// header comment for the incident (Cox: 13.9s DOMContentLoaded when this was
// computed eagerly for all 626 cards before first paint). This hook moves
// resolution off the critical path entirely:
//
//   (a) an idle-chunked background sweep pre-warms a cache for
//       cross-reference cards, a small batch per requestIdleCallback slice,
//       so most hovers hit a warm cache with zero compute;
//   (b) resolveReferences(card) is also safe to call synchronously at hover
//       time — O(references-on-this-card) via a prebuilt Map (see
//       buildDefinitionsIndex), never a scan of all definitions — so a card
//       the idle sweep hasn't reached yet still resolves instantly on
//       demand instead of blocking or showing nothing.
//
// Self-contained: builds its own definitions index from `cards`, so
// ProvisionCardTable (the only consumer) doesn't need reconstructReviewDeal
// or its caller to have computed resolvedReferences up front at all.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildDefinitionsIndex, resolveCardReferences } from '../../lib/queries/reconstruct-review-deal';

const IDLE_CHUNK_SIZE = 40;

// DOM-parity fix: the old eager pass hid the "N definitions" badge entirely
// when a card's references were all dangling (resolvedReferences.length ===
// 0 — e.g. a reference to a definition that got pruned/renamed). Showing
// card.references.length instead (the cheap, always-available count) would
// surface a badge for cards that previously rendered NO badge at all — a
// real DOM diff. This still needs a per-card "does at least one reference
// resolve" answer, but ONLY a Map.has() membership check (no
// projectDefinitionReference text copying) — O(total references across all
// cards), independent of how large each definition's text is, so it's safe
// to do eagerly alongside the definitions index.
function countResolvableReferences(cards, definitionsById) {
  const counts = new Map();
  for (const card of cards) {
    if (!Array.isArray(card.references) || card.references.length === 0) continue;
    let n = 0;
    for (const id of card.references) if (definitionsById.has(id)) n += 1;
    const key = card.provision_instance_id || card.id;
    if (key) counts.set(key, n);
  }
  return counts;
}

export function useDefinitionResolver(cards) {
  const list = Array.isArray(cards) ? cards : [];
  const definitionsById = useMemo(() => buildDefinitionsIndex(list), [list]);
  const resolvableCounts = useMemo(() => countResolvableReferences(list, definitionsById), [list, definitionsById]);
  const getResolvableCount = useCallback((card) => {
    const key = card && (card.provision_instance_id || card.id);
    return key ? (resolvableCounts.get(key) || 0) : 0;
  }, [resolvableCounts]);
  const cacheRef = useRef(new Map());
  // Bumped whenever the idle sweep resolves a new batch, so components
  // relying on a "has this warmed yet" render (rather than just calling
  // resolveReferences on demand) can re-render. ProvisionCardTable doesn't
  // need this today (it resolves on demand at hover), but it's cheap
  // insurance for future consumers that want to show resolved counts
  // without a hover.
  const [, bumpVersion] = useState(0);

  const resolveReferences = useCallback((card) => {
    if (!card) return { resolvedReferences: [], unresolvedReferences: [] };
    const key = card.provision_instance_id || card.id;
    if (key && cacheRef.current.has(key)) return cacheRef.current.get(key);
    const resolved = resolveCardReferences(card, definitionsById);
    if (key) cacheRef.current.set(key, resolved);
    return resolved;
  }, [definitionsById]);

  useEffect(() => {
    cacheRef.current = new Map();
    if (typeof window === 'undefined' || list.length === 0) return undefined;

    const candidates = list.filter((card) => Array.isArray(card.references) && card.references.length > 0);
    if (candidates.length === 0) return undefined;

    let cancelled = false;
    let offset = 0;
    const ric = window.requestIdleCallback
      || ((cb) => setTimeout(() => cb({ timeRemaining: () => 0, didTimeout: true }), 0));
    const cic = window.cancelIdleCallback || window.clearTimeout;
    let handle = null;

    const processChunk = (deadline) => {
      if (cancelled) return;
      let processed = 0;
      while (
        offset < candidates.length
        && processed < IDLE_CHUNK_SIZE
        && (!deadline || deadline.timeRemaining() > 0 || deadline.didTimeout)
      ) {
        const card = candidates[offset];
        const key = card.provision_instance_id || card.id;
        if (key && !cacheRef.current.has(key)) {
          cacheRef.current.set(key, resolveCardReferences(card, definitionsById));
        }
        offset += 1;
        processed += 1;
      }
      if (offset < candidates.length) {
        handle = ric(processChunk);
      } else {
        bumpVersion((n) => n + 1);
      }
    };

    handle = ric(processChunk);
    return () => {
      cancelled = true;
      if (handle != null) cic(handle);
    };
  }, [list, definitionsById]);

  return { resolveReferences, getResolvableCount };
}
