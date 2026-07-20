import { useState, useEffect, useMemo, useRef } from 'react';
import { parseFormattedDocument, stripFormattingMarkers } from '../../lib/parser-v2/format-renderer';
import {
  useEvidenceSelectionMode,
  typeHex,
  typeColor,
  typeLabel,
  favBadge,
} from './shared';
import { useViewMode } from '../ViewModeContext';

/* ═══════════════════════════════════════════════════════════
   FULL DOCUMENT VIEW — renders raw agreement text with
   provision-position highlight overlays. Reads like EDGAR.
   ═══════════════════════════════════════════════════════════ */
export function FullDocumentView({
  sourceText,
  title,
  provisions,
  onEditProvision,
  hoveredProvId,
  onHoverProv,
  reselectingProvLabel,
  isReselecting,
  onConfirmReselect,
  onCancelReselect,
  highlightedQuote,
  highlightedQuoteNonce,
}) {
  const { isEdit } = useViewMode();
  const containerRef = useRef(null);
  const [reselectSelection, setReselectSelection] = useState(null);
  // Highlight-effect retry (survives the mount/paint race on cross-tab jumps).
  const highlightRetryRef = useRef(0);
  const [highlightRetryTick, setHighlightRetryTick] = useState(0);
  useEffect(() => { highlightRetryRef.current = 0; }, [highlightedQuoteNonce]);

  // P5 item 7: evidence-selection mode (separate from reselect-text mode).
  // Pulls selectionMode from EvidenceContext so the floating bar + mouse-up
  // listener kick in whenever the editor activated selection capture.
  const { selectionMode, endSelectionMode } = useEvidenceSelectionMode();
  const [evidenceSelection, setEvidenceSelection] = useState(null);
  const evidenceModeActive = !!(selectionMode && selectionMode.active);

  useEffect(() => {
    if (!evidenceModeActive) {
      setEvidenceSelection(null);
      return undefined;
    }
    const handleSelectionChange = () => {
      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      if (!sel || sel.isCollapsed) {
        setEvidenceSelection(null);
        return;
      }
      const text = sel.toString();
      if (!text || !text.trim()) {
        setEvidenceSelection(null);
        return;
      }
      if (!containerRef.current || !sel.anchorNode || !containerRef.current.contains(sel.anchorNode)) {
        return;
      }
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setEvidenceSelection({ text: text.trim(), rect });
      } catch {
        setEvidenceSelection(null);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (typeof window !== 'undefined') {
          const sel = window.getSelection();
          if (sel) sel.removeAllRanges();
        }
        setEvidenceSelection(null);
        if (endSelectionMode) endSelectionMode();
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keydown', handleKey);
    };
  }, [evidenceModeActive, endSelectionMode]);

  const confirmEvidenceSelection = () => {
    if (!evidenceSelection || !selectionMode) return;
    const text = evidenceSelection.text;
    if (typeof window !== 'undefined') {
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    }
    setEvidenceSelection(null);
    if (selectionMode.onSelect) selectionMode.onSelect(text);
    if (endSelectionMode) endSelectionMode();
  };

  const cancelEvidenceSelection = () => {
    if (typeof window !== 'undefined') {
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    }
    setEvidenceSelection(null);
    if (endSelectionMode) endSelectionMode();
  };

  // P5 item 4: multi-highlight cycle state. When the highlighted quote matches
  // in N>1 text nodes we render a floating chevron ("1 / N") that lets the
  // user prev/next through the matches. activeMatchIdx tracks the current
  // index; matchCount is the number of matches found in the last pass.
  const [matchCount, setMatchCount] = useState(0);
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);

  // Reset active index whenever a fresh highlight request fires.
  useEffect(() => {
    setActiveMatchIdx(0);
  }, [highlightedQuote, highlightedQuoteNonce]);

  /* ── Stage 5: evidence-quote highlight overlay.
   *    When `highlightedQuote` is set, scan the DOM after render for the
   *    quote text (case-insensitive, whitespace-tolerant), wrap the first
   *    match in a transient yellow span, scroll it into view, and remove
   *    the overlay after a few seconds. */
  useEffect(() => {
    if (!highlightedQuote || !containerRef.current) return undefined;
    const root = containerRef.current;
    const target = String(highlightedQuote).trim();
    if (!target) return undefined;

    // Use whitespace-tolerant matching by working off a normalized version
    // of each text node's data and remembering original offsets.
    const normalize = (s) => s.replace(/\s+/g, ' ').trim();
    const fullNeedle = normalize(target);
    if (!fullNeedle) return undefined;
    // The matcher works PER TEXT NODE, so a long multi-paragraph quote (e.g.
    // an entire provision's full_text passed by a "details" click) would never
    // match a single node and the view would just jump to the top. Fall back
    // to progressively shorter anchors: full quote → first sentence → first
    // ~12 words. The first one that yields matches wins, so we always land on
    // (and highlight) the start of the relevant passage.
    const buildAnchors = (s) => {
      const out = [s];
      const firstSentence = s.split(/(?<=[.;:])\s/)[0];
      if (firstSentence && firstSentence.length >= 12 && firstSentence !== s) out.push(firstSentence);
      const words = s.split(' ');
      if (words.length > 12) out.push(words.slice(0, 12).join(' '));
      if (words.length > 6) out.push(words.slice(0, 6).join(' '));
      // Punctuation-tolerant fallback: the first run of 5–12 consecutive plain
      // alphabetic words (no digits/parentheses/section numbers). This is what
      // rescues coverage-gap and cross-reference jumps whose text starts with a
      // mangled prefix like "section 5.3):" — we anchor on the clean clause
      // language ("provided that the company shall be permitted to terminate")
      // which appears verbatim (case-insensitive) in the document.
      const cleanRun = s.match(/[a-z]+(?: [a-z]+){4,11}/i);
      if (cleanRun && cleanRun[0].length >= 20) out.push(cleanRun[0]);
      return out;
    };
    const anchors = buildAnchors(fullNeedle);

    // P5 item 4: collect ALL matches across text nodes so the user can cycle
    // through them via the chevron control. We restrict to per-text-node
    // matches (covers ~99% of quotes which are short, in-paragraph excerpts).
    // Try each anchor (full → sentence → leading words) until one matches.
    let needle = anchors[0];
    let needleLower = needle.toLowerCase();
    let matches = [];
    for (const anchor of anchors) {
      needle = anchor;
      needleLower = anchor.toLowerCase();
      matches = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = walker.nextNode())) {
      const nodeText = n.data;
      if (!nodeText) continue;
      const normalized = normalize(nodeText).toLowerCase();
      let searchFrom = 0;
      while (true) {
        const idx = normalized.indexOf(needleLower, searchFrom);
        if (idx < 0) break;
        // Map normalized index back to raw index (best-effort).
        let normPos = 0;
        let rawPos = 0;
        let prevSpace = true;
        while (rawPos < nodeText.length && normPos < idx) {
          const ch = nodeText[rawPos];
          if (/\s/.test(ch)) {
            if (!prevSpace) { normPos++; prevSpace = true; }
          } else {
            normPos++;
            prevSpace = false;
          }
          rawPos++;
        }
        let endRaw = rawPos;
        let consumed = 0;
        prevSpace = true;
        // Highlight the FULL target (the whole provision text), not just the
        // matched anchor, so the yellow span matches the provision shown in the
        // sidebar (#12). Anchors are prefixes of fullNeedle, so extend to
        // fullNeedle.length; capped at the node/paragraph end (endRaw guard),
        // which fully covers single-paragraph provisions and the first
        // paragraph of multi-paragraph ones.
        const coverLen = Math.max(needle.length, fullNeedle.length);
        while (endRaw < nodeText.length && consumed < coverLen) {
          const ch = nodeText[endRaw];
          if (/\s/.test(ch)) {
            if (!prevSpace) { consumed++; prevSpace = true; }
          } else {
            consumed++;
            prevSpace = false;
          }
          endRaw++;
        }
        if (endRaw > rawPos) {
          matches.push({ node: n, start: rawPos, end: endRaw });
        }
        searchFrom = idx + Math.max(1, needleLower.length);
      }
      }
      if (matches.length > 0) break; // this anchor matched — stop narrowing
    }

    // Update chevron state. Use functional setState w/ same-value guard so
    // we don't spin re-renders on every effect run.
    setMatchCount((prev) => (prev === matches.length ? prev : matches.length));
    if (matches.length === 0) {
      // Mount/paint race: when a jump comes from another tab (e.g. clicking a
      // coverage gap in the trust dropdown), this effect can run before the
      // large document text is painted, so nothing matches. Retry a few times
      // (~200ms apart) until the content is there. Bounded so a genuinely
      // absent quote stops after ~1.6s.
      if (highlightRetryRef.current < 8) {
        const attempt = highlightRetryRef.current + 1;
        highlightRetryRef.current = attempt;
        const t = setTimeout(() => setHighlightRetryTick(attempt), 200);
        return () => clearTimeout(t);
      }
      return undefined;
    }
    const safeIdx = Math.max(0, Math.min(activeMatchIdx, matches.length - 1));
    const pick = matches[safeIdx];
    const foundNode = pick.node;
    const foundIdx = pick.start;
    foundNode.__hlEnd = pick.end;

    let span;
    try {
      const range = document.createRange();
      range.setStart(foundNode, foundIdx);
      range.setEnd(foundNode, foundNode.__hlEnd);
      span = document.createElement('span');
      // Clear, sustained highlight: strong amber background + ring + a brief
      // bright-flash pulse on arrival so the eye lands on the right section.
      span.className = 'rounded px-0.5 ring-2 ring-amber-400';
      span.style.backgroundColor = '#fde68a'; // amber-200, sustained
      span.style.boxShadow = '0 0 0 3px rgba(251,191,36,0.35)';
      span.dataset.evidenceHighlight = '1';
      range.surroundContents(span);
      // Scroll into view, then flash brighter for ~1s to draw the eye.
      span.scrollIntoView({ behavior: 'smooth', block: 'center' });
      span.style.transition = 'background-color 1.2s ease-out, box-shadow 1.2s ease-out';
      const prevBg = span.style.backgroundColor;
      span.style.backgroundColor = '#fbbf24'; // amber-400 flash
      setTimeout(() => {
        if (span && span.style) {
          // Settle back to the sustained (not fully transparent) highlight so
          // the section stays clearly marked after the flash.
          span.style.backgroundColor = prevBg;
        }
      }, 900);
    } catch {
      // Range surroundContents can throw if the range crosses element
      // boundaries — silently skip in that rare case.
    }

    return () => {
      // Cleanup: unwrap the span on unmount or when the quote changes.
      if (span && span.parentNode) {
        const parent = span.parentNode;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
        parent.normalize();
      }
    };
    // Re-run when the quote changes OR when the same quote is re-clicked
    // (nonce bump forces re-mount of the highlight even if quote is identical).
    // Also re-runs when activeMatchIdx changes (chevron prev/next).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedQuote, highlightedQuoteNonce, sourceText, activeMatchIdx, highlightRetryTick]);

  // Track selection while in re-select mode
  useEffect(() => {
    if (!isReselecting) {
      setReselectSelection(null);
      return undefined;
    }

    const handleSelectionChange = () => {
      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      if (!sel || sel.isCollapsed) {
        setReselectSelection(null);
        return;
      }
      const text = sel.toString();
      if (!text || !text.trim()) {
        setReselectSelection(null);
        return;
      }
      // Must be inside our document container
      if (!containerRef.current || !sel.anchorNode || !containerRef.current.contains(sel.anchorNode)) {
        return;
      }
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setReselectSelection({ text, rect });
      } catch {
        setReselectSelection(null);
      }
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (typeof window !== 'undefined') {
          const sel = window.getSelection();
          if (sel) sel.removeAllRanges();
        }
        setReselectSelection(null);
        if (onCancelReselect) onCancelReselect();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isReselecting, onCancelReselect]);

  const handleConfirmReselect = () => {
    if (!reselectSelection || !onConfirmReselect) return;
    const text = reselectSelection.text;
    if (typeof window !== 'undefined') {
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    }
    setReselectSelection(null);
    onConfirmReselect(text);
  };

  // Detect whether the stored text uses our formatting markers. If so we
  // render structured blocks; otherwise we fall back to the legacy <pre>
  // rendering for older deals ingested before formatting was added.
  const isFormatted = useMemo(
    () => !!sourceText && sourceText.includes('[[') && sourceText.includes(']]'),
    [sourceText]
  );

  // Plain text version of the source (no markers). Used to locate provision
  // text via indexOf without the markers throwing off positions.
  const plainText = useMemo(
    () => (sourceText ? (isFormatted ? stripFormattingMarkers(sourceText) : sourceText) : ''),
    [sourceText, isFormatted]
  );

  // Parsed block structure (only used when isFormatted).
  const blocks = useMemo(
    () => (isFormatted ? parseFormattedDocument(sourceText) : []),
    [sourceText, isFormatted]
  );

  // Build highlight regions as offsets into the plain (marker-stripped) text.
  // Both the structured renderer and the legacy <pre> rely on these.
  //
  // Strategy: match SHORTEST provisions first (they're more specific — e.g.
  // a 200-char DEF that lives inside a 5000-char NOSOL). Allow overlapping
  // regions; the renderer layers them so shorter (more specific) provisions
  // sit on top of longer ones.
  //
  // Tolerant matching, in order: explicit char positions (legacy unformatted
  // ingests only) → exact case-insensitive → whitespace-normalized → first 200
  // chars (signature) → first 60 chars → "SECTION X.XX" header for provisions
  // that begin with a section heading.
  const { regions, unmatched } = useMemo(() => {
    if (!plainText) return { regions: [], unmatched: [] };

    const lowerSource = plainText.toLowerCase();

    // Pre-compute whitespace-normalized source. We keep an index map from
    // normalized offset → original offset so we can translate matches back.
    const normMap = [];
    let normalizedSource = '';
    {
      let prevWasSpace = false;
      for (let i = 0; i < plainText.length; i++) {
        const ch = plainText[i];
        const isWs = /\s/.test(ch);
        if (isWs) {
          if (!prevWasSpace) {
            normalizedSource += ' ';
            normMap.push(i);
            prevWasSpace = true;
          }
        } else {
          normalizedSource += ch.toLowerCase();
          normMap.push(i);
          prevWasSpace = false;
        }
      }
      // sentinel so normMap[normalizedSource.length] is valid
      normMap.push(plainText.length);
    }

    const normalize = (s) => {
      let out = '';
      let prevWasSpace = false;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const isWs = /\s/.test(ch);
        if (isWs) {
          if (!prevWasSpace) {
            out += ' ';
            prevWasSpace = true;
          }
        } else {
          out += ch.toLowerCase();
          prevWasSpace = false;
        }
      }
      return out.trim();
    };

    // Match against the normalized source and translate back. Returns
    // [start, end] in original plainText offsets, or null.
    const findNormalized = (needle) => {
      const n = normalize(needle);
      if (!n) return null;
      const idx = normalizedSource.indexOf(n);
      if (idx < 0) return null;
      const start = normMap[idx];
      const endNorm = idx + n.length;
      const end = normMap[Math.min(endNorm, normMap.length - 1)];
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
      return [start, end];
    };

    // Match a provision against the source using a cascade of strategies.
    // Returns { start, end, strategy } or null.
    const matchProvision = (p) => {
      // Legacy explicit positions, only when source is not formatted.
      if (!isFormatted) {
        const explicitStart = p.start_char ?? p.startChar;
        const explicitEnd = p.end_char ?? p.endChar;
        if (
          Number.isFinite(explicitStart) &&
          Number.isFinite(explicitEnd) &&
          explicitStart >= 0 &&
          explicitEnd <= plainText.length &&
          explicitEnd > explicitStart
        ) {
          return { start: explicitStart, end: explicitEnd, strategy: 'explicit' };
        }
      }

      const pText = (p.full_text || '').trim();
      if (!pText) return null;

      // 1. Exact case-insensitive.
      const exactIdx = lowerSource.indexOf(pText.toLowerCase());
      if (exactIdx >= 0) {
        return { start: exactIdx, end: exactIdx + pText.length, strategy: 'exact' };
      }

      // 2. Whitespace-normalized full text.
      const normHit = findNormalized(pText);
      if (normHit) {
        return { start: normHit[0], end: normHit[1], strategy: 'normalized' };
      }

      // 3. First 200-char signature, normalized. Use the actual provision
      //    length so the highlight covers what the AI extracted.
      if (pText.length > 200) {
        const sig = pText.substring(0, 200);
        const sigHit = findNormalized(sig);
        if (sigHit) {
          const end = Math.min(sigHit[0] + pText.length, plainText.length);
          return { start: sigHit[0], end, strategy: 'signature-200' };
        }
      }

      // 4. First 60-char signature for shorter provisions.
      if (pText.length > 60) {
        const sig = pText.substring(0, 60);
        const sigHit = findNormalized(sig);
        if (sigHit) {
          const end = Math.min(sigHit[0] + pText.length, plainText.length);
          return { start: sigHit[0], end, strategy: 'signature-60' };
        }
      }

      // 5. "SECTION X.XX" header. If the provision begins with a section
      //    number, find that section header in the document.
      const sectionMatch = pText.match(/^(SECTION\s+\d+\.\d+|Section\s+\d+\.\d+|ARTICLE\s+[IVXLCDM]+|Article\s+[IVXLCDM]+)/);
      if (sectionMatch) {
        const header = sectionMatch[0];
        // Look case-sensitively (sections are usually all-caps) then fallback.
        let hIdx = plainText.indexOf(header);
        if (hIdx < 0) hIdx = lowerSource.indexOf(header.toLowerCase());
        if (hIdx >= 0) {
          const end = Math.min(hIdx + pText.length, plainText.length);
          return { start: hIdx, end, strategy: 'section-header' };
        }
      }

      // 6. Defined-term anchor — DEF provisions usually start with `"Term"`.
      const defMatch = pText.match(/^\s*[“"]([^"”]+)[”"]\s+(?:shall mean|means|has the meaning)/i);
      if (defMatch) {
        const term = defMatch[1];
        // Search for the quoted term in the source.
        const candidates = [`"${term}"`, `“${term}”`, `"${term}"`];
        for (const c of candidates) {
          const cIdx = plainText.indexOf(c);
          if (cIdx >= 0) {
            const end = Math.min(cIdx + pText.length, plainText.length);
            return { start: cIdx, end, strategy: 'defined-term' };
          }
        }
      }

      return null;
    };

    // Sort by full_text length ASCENDING so shorter (more specific) provisions
    // claim their positions first. Provisions with no text sort last.
    const ordered = [...provisions].sort((a, b) => {
      const aLen = (a.full_text || '').length || Infinity;
      const bLen = (b.full_text || '').length || Infinity;
      return aLen - bLen;
    });

    const matched = [];
    const notMatched = [];
    ordered.forEach((p) => {
      const hit = matchProvision(p);
      if (hit) {
        matched.push({ start: hit.start, end: hit.end, provision: p, strategy: hit.strategy });
      } else {
        notMatched.push(p);
      }
    });

    // Sort matched regions for rendering. Primary: start ascending.
    // Secondary: end descending (so the longest region containing this
    // start is emitted first, ahead of shorter nested regions). The
    // renderer assumes this ordering when layering.
    matched.sort((a, b) => a.start - b.start || b.end - a.end);

    return { regions: matched, unmatched: notMatched };
  }, [plainText, provisions, isFormatted]);

  // Collapsible unmatched-provisions panel toggle.
  const [showUnmatched, setShowUnmatched] = useState(false);

  if (!sourceText) {
    return (
      <div className="bg-white border border-border rounded-lg shadow-sm p-8 text-center">
        <p className="text-inkFaint font-ui text-sm">
          No raw agreement text stored for this deal.
        </p>
        <p className="text-inkFaint font-ui text-xs mt-2">
          Re-ingest the agreement to populate the Full Document view.
        </p>
      </div>
    );
  }

  // Build alternating segments for the legacy <pre> renderer (used when the
  // stored text does not contain formatting markers — i.e. older ingests).
  // Regions may overlap, so we slice at every breakpoint and emit one span
  // per atomic slice, layered by nesting innermost (shortest) on top.
  const segments = [];
  if (!isFormatted) {
    // Collect all breakpoints.
    const breakpoints = new Set([0, plainText.length]);
    regions.forEach((r) => {
      breakpoints.add(Math.max(0, r.start));
      breakpoints.add(Math.min(plainText.length, r.end));
    });
    const bps = Array.from(breakpoints).sort((a, b) => a - b);

    for (let i = 0; i < bps.length - 1; i++) {
      const segStart = bps[i];
      const segEnd = bps[i + 1];
      if (segEnd <= segStart) continue;
      const covering = regions.filter((r) => r.start <= segStart && r.end >= segEnd);
      if (covering.length === 0) {
        segments.push({ type: 'text', content: plainText.slice(segStart, segEnd), key: `t-${segStart}` });
      } else {
        // Innermost (shortest) provision wins as the foreground highlight.
        const innermost = covering.reduce((best, r) =>
          (r.end - r.start) < (best.end - best.start) ? r : best
        );
        segments.push({
          type: 'highlight',
          content: plainText.slice(segStart, segEnd),
          provision: innermost.provision,
          layers: covering.length,
          key: `h-${segStart}-${innermost.provision.id || ''}`,
        });
      }
    }
  }

  // Render helper for highlighted text within a block. Handles overlapping
  // regions by slicing at every breakpoint and rendering the innermost
  // (shortest) provision as the visible highlight for each slice. Outer
  // (larger) provisions still receive a click-target via the wrapping span,
  // but the visual foreground is the most specific provision.
  const renderHighlightedText = (rawText, blockOffset) => {
    if (!rawText) return null;
    const blockEnd = blockOffset + rawText.length;
    const local = regions.filter((r) => r.start < blockEnd && r.end > blockOffset);
    if (local.length === 0) return rawText;

    // Breakpoints inside this block.
    const bpSet = new Set([blockOffset, blockEnd]);
    local.forEach((r) => {
      bpSet.add(Math.max(blockOffset, r.start));
      bpSet.add(Math.min(blockEnd, r.end));
    });
    const bps = Array.from(bpSet).sort((a, b) => a - b);

    const out = [];
    for (let i = 0; i < bps.length - 1; i++) {
      const segStart = bps[i];
      const segEnd = bps[i + 1];
      if (segEnd <= segStart) continue;
      const covering = local.filter((r) => r.start <= segStart && r.end >= segEnd);
      const text = plainText.slice(segStart, segEnd);
      if (covering.length === 0) {
        out.push(<span key={`pt-${segStart}`}>{text}</span>);
        continue;
      }
      // Innermost (shortest) is the visible highlight.
      const innermost = covering.reduce((best, r) =>
        (r.end - r.start) < (best.end - best.start) ? r : best
      );
      const p = innermost.provision;
      const tHex = typeHex(p.type);
      const isHovered = hoveredProvId === p.id;
      // When this slice is covered by multiple regions, show a faint
      // gutter-stack indicator to hint at nesting depth.
      const stackBorders = covering.length > 1
        ? `inset ${2 + (covering.length - 1) * 2}px 0 0 ${tHex}`
        : `inset 2px 0 0 ${tHex}`;
      out.push(
        <span
          key={`ph-${segStart}-${p.id || i}`}
          id={`prov-${p.id}`}
          onClick={(ev) => { ev.stopPropagation(); onEditProvision(p); }}
          onMouseEnter={() => onHoverProv && onHoverProv(p.id)}
          onMouseLeave={() => onHoverProv && onHoverProv(null)}
          className="relative cursor-pointer transition-colors rounded-sm"
          style={{
            backgroundColor: isHovered
              ? 'color-mix(in srgb, var(--accent) 22%, transparent)'
              : 'var(--accent-soft)',
            boxShadow: stackBorders,
            paddingLeft: '3px',
            paddingRight: '2px',
          }}
          title={
            covering.length > 1
              ? `${typeLabel(p.type)} -- ${p.category || 'General'} (${covering.length} overlapping provisions)`
              : `${typeLabel(p.type)} -- ${p.category || 'General'}`
          }
        >
          {text}
        </span>
      );
    }
    return out;
  };

  // Walk parsed blocks and compute the running offset of each block's plain
  // text content within `plainText`. Used so we know where in the global
  // offset space each block's inline content lives, so we can intersect with
  // provision regions for highlighting.
  const renderInlineTokens = (inlineTokens, startOffset) => {
    if (!inlineTokens) return null;
    const out = [];
    let off = startOffset;
    inlineTokens.forEach((tok, i) => {
      const t = tok.text || '';
      if (tok.type === 'ref') {
        out.push(<span key={`r-${i}`} className="doc-ref">{renderHighlightedText(t, off)}</span>);
      } else if (tok.type === 'defined') {
        out.push(<span key={`d-${i}`} className="doc-defined">{renderHighlightedText(t, off)}</span>);
      } else {
        out.push(<span key={`t-${i}`}>{renderHighlightedText(t, off)}</span>);
      }
      off += t.length;
    });
    return out;
  };

  // Walk blocks producing React nodes and tracking the offset into plainText.
  const renderBlocks = (blockList) => {
    const nodes = [];
    let cursor = 0;
    // The plainText has identical leading content to each block in order; we
    // sync up by searching for each block's leading characters from `cursor`.
    // This is robust against whitespace differences between blocks and the
    // joined plain text.

    const blockPlainLen = (b) => {
      if (b.type === 'paragraph' || b.type === 'section') {
        return (b.inline || []).reduce((s, t) => s + (t.text || '').length, 0)
          + (b.type === 'section' ? (b.number.length + b.title.length + 4) : 0);
      }
      if (b.type === 'article') return b.number.length + b.title.length + 1;
      if (b.type === 'article_title') return b.text.length;
      if (b.type === 'center') return b.text.length;
      if (b.type === 'toc') return 0; // handled separately
      return 0;
    };

    blockList.forEach((b, i) => {
      if (b.type === 'article') {
        nodes.push(
          <div key={`a-${i}`} className="doc-article">
            <div className="text-center font-display text-xl font-bold mt-10 mb-1 tracking-wider">
              {b.number}
            </div>
            {b.title && (
              <div className="text-center font-display text-lg mb-6 italic">
                {b.title}
              </div>
            )}
          </div>
        );
        // Advance cursor past this block's plain text (best-effort).
        const consume = `${b.number}${b.title ? '\n' + b.title : ''}`;
        const idx = plainText.indexOf(consume, cursor);
        if (idx >= 0) cursor = idx + consume.length;
      } else if (b.type === 'article_title') {
        nodes.push(
          <div key={`at-${i}`} className="text-center font-display text-lg mb-6 italic">
            {b.text}
          </div>
        );
        const idx = plainText.indexOf(b.text, cursor);
        if (idx >= 0) cursor = idx + b.text.length;
      } else if (b.type === 'center') {
        nodes.push(
          <div key={`c-${i}`} className="text-center font-display text-2xl mt-8 mb-6 tracking-wide">
            {b.text}
          </div>
        );
        const idx = plainText.indexOf(b.text, cursor);
        if (idx >= 0) cursor = idx + b.text.length;
      } else if (b.type === 'toc') {
        nodes.push(
          <div key={`toc-${i}`} className="doc-toc my-8 p-5 bg-bg/50 rounded-lg border border-border text-sm">
            {b.children.map((c, j) => {
              if (c.type === 'toc_heading') {
                return (
                  <div key={j} className="text-center font-display text-xl font-bold mb-4 tracking-wider">
                    {c.text}
                  </div>
                );
              }
              if (c.type === 'toc_article') {
                return (
                  <div key={j} className="mt-4 mb-1 text-center font-display font-bold">
                    {c.number}{c.title ? ` -- ${c.title}` : ''}
                  </div>
                );
              }
              if (c.type === 'toc_entry') {
                return (
                  <div key={j} className="flex items-baseline gap-2 py-0.5">
                    <span className="text-inkMid">{c.number}.</span>
                    <span className="flex-1 truncate">{c.title}</span>
                    {c.page && (
                      <>
                        <span className="flex-1 border-b border-dotted border-inkFaint/40 mx-1 mb-1" />
                        <span className="text-inkMid tabular-nums">{c.page}</span>
                      </>
                    )}
                  </div>
                );
              }
              if (c.type === 'toc_text') {
                return (
                  <div key={j} className="text-inkMid my-2">
                    {renderInlineTokens(c.inline, 0)}
                  </div>
                );
              }
              return null;
            })}
          </div>
        );
        // Advance past the TOC region. The TOC blocks in plainText end before
        // the body preamble ("This AGREEMENT...") or the first body ARTICLE.
        const tocStart = plainText.indexOf('TABLE OF CONTENTS', cursor);
        if (tocStart >= 0) {
          const candidates = [
            plainText.indexOf('This AGREEMENT', tocStart + 'TABLE OF CONTENTS'.length),
            plainText.indexOf('ARTICLE I\n', tocStart + 'TABLE OF CONTENTS'.length),
            plainText.indexOf('WHEREAS', tocStart + 'TABLE OF CONTENTS'.length),
          ].filter(x => x > 0);
          cursor = candidates.length > 0
            ? Math.min(...candidates)
            : tocStart + 'TABLE OF CONTENTS'.length;
        }
      } else if (b.type === 'section') {
        // Find offset of section heading in plainText
        const headingStr = `${b.number} ${b.title}`.trim();
        // Sync cursor on the section number
        const idx = plainText.indexOf(b.number, cursor);
        if (idx >= 0) cursor = idx;
        const sectionStart = cursor;
        // Section body inline text starts after "number title. " (roughly)
        // We render headings as their own styled elements then body inline.
        // Compute inlineStart = offset where the inline text begins.
        // In plainText, the section likely reads: "SECTION X.XX. Title. body..."
        // Skip past number + title in plainText:
        const numLen = b.number.length;
        let inlineStart = sectionStart + numLen;
        // skip whitespace + title + ". " sequence
        const after = plainText.substring(inlineStart);
        const titleIdx = b.title ? after.indexOf(b.title) : -1;
        if (titleIdx >= 0) {
          inlineStart += titleIdx + b.title.length;
          // skip optional ". "
          while (inlineStart < plainText.length && /[. \n]/.test(plainText[inlineStart])) {
            inlineStart++;
          }
        }
        cursor = inlineStart;
        const inlineLen = (b.inline || []).reduce((s, t) => s + (t.text || '').length, 0);
        nodes.push(
          <p key={`s-${i}`} className="my-3 leading-relaxed">
            <span className="font-bold font-display">{b.number} </span>
            {b.title && <span className="font-bold">{b.title}. </span>}
            {renderInlineTokens(b.inline, cursor)}
          </p>
        );
        cursor += inlineLen;
      } else if (b.type === 'paragraph') {
        const text = (b.inline || []).map(t => t.text || '').join('');
        const idx = text ? plainText.indexOf(text.substring(0, Math.min(80, text.length)), cursor) : -1;
        if (idx >= 0) cursor = idx;
        const inlineStart = cursor;
        nodes.push(
          <p key={`p-${i}`} className="my-3 leading-relaxed">
            {renderInlineTokens(b.inline, inlineStart)}
          </p>
        );
        cursor += text.length;
      }
    });

    return nodes;
  };

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm">
      {/* Re-select banner */}
      {isReselecting && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 flex items-center justify-between gap-3">
          <div className="text-xs font-ui text-amber-800">
            Select the correct text for <span className="font-semibold">{reselectingProvLabel || 'provision'}</span>{' '}
            -- click and drag to highlight, then click &quot;Use Selection&quot;.
          </div>
          <button
            type="button"
            onClick={onCancelReselect}
            className="px-2 py-1 text-[11px] font-ui border border-amber-300 text-amber-800 rounded hover:bg-amber-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Document header bar (EDGAR-style) */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between bg-bg/40">
        <div>
          <p className="font-ui text-[10px] uppercase tracking-wider text-inkFaint">
            Agreement
          </p>
          <p className="font-display text-sm text-ink">{title || 'Agreement'}</p>
        </div>
        <div className="text-[10px] font-ui text-inkFaint text-right">
          {/* "N of M highlighted" / "unmatched" are matcher-quality (extraction
              status) indicators — editors only. Users just see the doc. */}
          {isEdit ? (
            <>
              <div>
                {regions.length} of {provisions.length} provisions highlighted &middot;{' '}
                {sourceText.length.toLocaleString()} chars
              </div>
              {unmatched.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowUnmatched((v) => !v)}
                  className="mt-0.5 underline decoration-dotted hover:text-ink transition-colors"
                >
                  {showUnmatched ? 'Hide' : 'Show'} {unmatched.length} unmatched
                </button>
              )}
            </>
          ) : (
            <div>{sourceText.length.toLocaleString()} chars</div>
          )}
        </div>
      </div>

      {/* Unmatched provisions list — collapsible, editors only */}
      {isEdit && showUnmatched && unmatched.length > 0 && (
        <div className="border-b border-border px-6 py-3 bg-amber-50/40 max-h-48 overflow-y-auto">
          <p className="font-ui text-[10px] uppercase tracking-wider text-amber-800 mb-2">
            Unmatched provisions ({unmatched.length})
          </p>
          <ul className="space-y-1">
            {unmatched.map((p) => {
              const tc = typeColor(p.type);
              const preview = (p.full_text || '').trim().slice(0, 100);
              return (
                <li key={p.id} className="text-[11px] font-ui flex items-start gap-2">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium border shrink-0 ${tc.border} ${tc.bg} ${tc.text}`}
                  >
                    {typeLabel(p.type)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onEditProvision(p)}
                    className="text-left text-inkMid hover:text-ink transition-colors truncate"
                    title={p.full_text || ''}
                  >
                    <span className="text-ink">{p.category || 'General'}</span>
                    {/* E (truncation sweep): drop the literal "…" -- the
                        button's `title` already carries the full text, and
                        clicking opens the provision for editing. */}
                    {preview && <span className="text-inkFaint"> — {preview}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Document body */}
      <div ref={containerRef} className="relative p-6 md:p-12 max-h-[80vh] overflow-y-auto">
        {/* P5 item 7: evidence-selection mode floating bar. */}
        {evidenceModeActive && (
          <div className="sticky top-0 z-30 bg-amber-100 border border-amber-300 rounded-md shadow-md px-3 py-2 mb-3 flex items-center justify-between text-xs font-ui">
            <span className="text-amber-900">
              Selecting evidence for: <span className="font-semibold">{selectionMode?.label || 'evidence'}</span>. Highlight text in the document, then click "Use selection".
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={confirmEvidenceSelection}
                disabled={!evidenceSelection}
                className="px-2 py-1 text-[11px] bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
              >
                Use selection
              </button>
              <button
                type="button"
                onClick={cancelEvidenceSelection}
                className="px-2 py-1 text-[11px] border border-amber-400 text-amber-900 rounded hover:bg-amber-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {/* P5 item 4: multi-match chevron cycle. Renders only when the current
            evidence quote matches in >1 places in the document. Sticks to the
            top-right of the scrolling viewport. */}
        {highlightedQuote && matchCount > 1 && (
          <div
            className="sticky top-2 z-20 ml-auto inline-flex items-center gap-1 bg-yellow-50 border border-yellow-300 rounded-full shadow-md px-2 py-1 text-[11px] font-ui text-amber-900"
            style={{ float: 'right' }}
          >
            <button
              type="button"
              onClick={() => setActiveMatchIdx((i) => (i - 1 + matchCount) % matchCount)}
              className="w-5 h-5 inline-flex items-center justify-center rounded hover:bg-yellow-200"
              title="Previous match"
              aria-label="Previous match"
            >
              {'<'}
            </button>
            <span className="font-medium tabular-nums">
              {Math.max(0, Math.min(activeMatchIdx, matchCount - 1)) + 1} / {matchCount}
            </span>
            <button
              type="button"
              onClick={() => setActiveMatchIdx((i) => (i + 1) % matchCount)}
              className="w-5 h-5 inline-flex items-center justify-center rounded hover:bg-yellow-200"
              title="Next match"
              aria-label="Next match"
            >
              {'>'}
            </button>
          </div>
        )}
        {isFormatted ? (
          <div
            className="max-w-3xl mx-auto text-[15px] text-ink leading-[1.75]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {renderBlocks(blocks)}
          </div>
        ) : (
          <pre
            className="text-[14px] text-ink leading-[1.7] whitespace-pre-wrap break-words m-0"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {segments.map(seg => {
              if (seg.type === 'text') {
                return <span key={seg.key}>{seg.content}</span>;
              }
              const p = seg.provision;
              const tHex = typeHex(p.type);
              const fav = favBadge(p.ai_favorability);
              const isHovered = hoveredProvId === p.id;
              const layers = seg.layers || 1;
              const stackBorders = layers > 1
                ? `inset ${2 + (layers - 1) * 2}px 0 0 ${tHex}`
                : `inset 2px 0 0 ${tHex}`;
              return (
                <span
                  key={seg.key}
                  id={`prov-${p.id}`}
                  onClick={(e) => { e.stopPropagation(); onEditProvision(p); }}
                  onMouseEnter={() => onHoverProv && onHoverProv(p.id)}
                  onMouseLeave={() => onHoverProv && onHoverProv(null)}
                  className="relative cursor-pointer transition-colors rounded-sm"
                  style={{
                    backgroundColor: isHovered
                      ? 'color-mix(in srgb, var(--accent) 22%, transparent)'
                      : 'var(--accent-soft)',
                    boxShadow: stackBorders,
                    paddingLeft: '4px',
                    paddingRight: '2px',
                  }}
                  title={
                    layers > 1
                      ? `${typeLabel(p.type)} -- ${p.category || 'General'} (${layers} overlapping provisions)`
                      : `${typeLabel(p.type)} -- ${p.category || 'General'}`
                  }
                >
                  {isHovered && (
                    <span
                      className={`absolute z-20 -top-6 left-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-ui font-medium border whitespace-nowrap shadow-sm ${tc.border} ${tc.bg} ${tc.text}`}
                      style={{ fontFamily: 'inherit' }}
                    >
                      <span>{typeLabel(p.type)}</span>
                      <span className="text-inkFaint">&middot;</span>
                      <span>{p.category || 'General'}</span>
                      <span className={`ml-1 px-1 rounded ${fav.cls}`}>{fav.label}</span>
                    </span>
                  )}
                  {seg.content}
                </span>
              );
            })}
          </pre>
        )}
      </div>

      {/* Floating "Use This Text" button while re-selecting */}
      {isReselecting && reselectSelection && reselectSelection.rect && (
        <div
          style={{
            position: 'fixed',
            top: reselectSelection.rect.bottom + 8,
            left: Math.max(
              8,
              reselectSelection.rect.left + (reselectSelection.rect.width / 2) - 80
            ),
            zIndex: 60,
          }}
          className="animate-slide-up"
        >
          <button
            onMouseDown={(e) => { e.preventDefault(); handleConfirmReselect(); }}
            className="px-4 py-2 text-xs font-ui bg-accent text-white rounded-lg shadow-lg hover:bg-accent/90 transition-colors flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 6l3 3 5-6" />
            </svg>
            Use This Text
          </button>
        </div>
      )}
    </div>
  );
}
