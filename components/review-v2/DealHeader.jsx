// Review V2 ("Mergertrace") masthead — ported from the design-lab
// DealHeader prototype, fed by real deal data. Sticky 108px bar: identity
// block, metric columns, and the Full Agreement / Back to Summary toggle.

import { useClauseSearchMode } from './clauseSearchMode.js';

function formatDealValue(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e9) {
    const b = n / 1e9;
    return `$${b >= 100 ? Math.round(b) : b.toFixed(1)}B`;
  }
  if (n >= 1e6) {
    const m = n / 1e6;
    return `$${m >= 100 ? Math.round(m) : m.toFixed(1)}M`;
  }
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function formatDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  // Date-only strings parse as UTC midnight; format in UTC so the calendar
  // date survives the NYC offset.
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const CONSIDERATION_LABELS = {
  CASH: 'Cash',
  STOCK: 'Stock',
  MIXED: 'Mixed cash/stock',
  MIXED_ELECTION: 'Mixed election',
  CASH_PLUS_CVR: 'Cash + CVR',
  STOCK_PLUS_CVR: 'Stock + CVR',
  MIXED_PLUS_CVR: 'Mixed + CVR',
};

function titleCase(raw) {
  return String(raw)
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function factScalar(fact) {
  if (fact === null || fact === undefined) return null;
  if (typeof fact === 'object') return fact.summary ?? fact.value ?? fact.label ?? fact.text ?? null;
  return fact;
}

// Build the metric-column list. Deal-level basics (date, value, structure,
// sector) come from the deal row; CONSIDERATION and PER SHARE come from the
// EXTRACTED cards (`extracted`, derived by deriveExtractedHeaderFacts from
// the same consideration-hero rows the Consideration table renders).
// metadata.deal_facts / headlineConsiderationType are FALLBACKS only — they
// are stale or absent on many deals (Metsera carries a legacy CASH headline
// although the extracted deal is cash + CVR).
export function deriveMetrics(deal, extracted = {}) {
  if (!deal) return [];
  const meta = deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const facts = meta.deal_facts && typeof meta.deal_facts === 'object' ? meta.deal_facts : {};
  const metrics = [];

  const announced = formatDate(deal.announce_date);
  if (announced) metrics.push({ label: 'Announced', value: announced });

  const value = formatDealValue(factScalar(facts.value_usd) ?? deal.value_usd);
  if (value) metrics.push({ label: 'Deal value', value });

  const considerationRaw = extracted.consideration
    || factScalar(facts.consideration)
    || meta.headlineConsiderationType
    || meta.headline_consideration_type
    || null;
  if (considerationRaw) {
    const key = String(considerationRaw).toUpperCase();
    metrics.push({ label: 'Consideration', value: CONSIDERATION_LABELS[key] || String(considerationRaw) });
  }

  const perShare = extracted.perShare
    ?? (factScalar(facts.price_per_share) ?? factScalar(facts.per_share));
  if (perShare) metrics.push({ label: 'Per share', value: String(perShare) });

  const termFee = factScalar(facts.termination_fee);
  if (termFee) metrics.push({ label: 'Termination fee', value: String(termFee) });

  if (meta.merger_form) metrics.push({ label: 'Structure', value: titleCase(meta.merger_form), priority: 2 });
  if (deal.sector) metrics.push({ label: 'Sector', value: deal.sector, priority: 3 });

  return metrics;
}

// Masthead control for clauseSearchMode.js's toggle -- the ONE place on the
// review page guaranteed visible on every load without scrolling, so a
// reader has a real chance of discovering it before reaching for Ctrl+F.
// Off by default: an ordinary find-in-page only ever matches what's already
// on screen. Switching it on makes every "See provision" disclosure render
// as real, expanded, searchable content instead -- see clauseSearchMode.js
// for the full rationale and ProvisionTablePrimitives.jsx's
// SeeProvisionDisclosure for the mechanism.
function ClauseSearchToggle() {
  const [enabled, setEnabled] = useClauseSearchMode();
  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      aria-pressed={enabled}
      data-testid="clause-search-mode-toggle"
      title={enabled
        ? 'Clause text is expanded and searchable. Click to collapse it again.'
        : 'Expand every "See provision" clause so Ctrl+F / Cmd+F can search inside it.'}
      className={`inline-flex items-center gap-1.5 px-3 py-2 border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition ${
        enabled
          ? 'border-[#1F1F1F] bg-[#1F1F1F] text-white'
          : 'border-[#E0E0E0] text-[#6B6B6B] hover:border-[#1F1F1F] hover:text-[#1F1F1F]'
      }`}
    >
      <span aria-hidden="true">{enabled ? '☑' : '☐'}</span>
      Search clause text
    </button>
  );
}

export function deriveStatus(deal) {
  const facts = deal?.metadata?.deal_facts;
  const factStatus = factScalar(facts && facts.status);
  if (factStatus) return String(factStatus).toUpperCase();
  return deal?.announce_date ? 'ANNOUNCED' : 'PENDING';
}

export default function DealHeader({ deal, view, onToggleView, hasAgreementText, extracted }) {
  const meta = deal?.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const targetName = meta.target_display || deal?.target || 'Loading…';
  const acquirerName = meta.acquirer_display || deal?.acquirer || null;
  const metrics = deriveMetrics(deal, extracted || {});
  const rawStatus = deal ? deriveStatus(deal) : null;
  // 'ANNOUNCED' next to the 'Announced <date>' metric read as a duplicate —
  // only surface the chip when the status says something the date doesn't.
  const status = rawStatus === 'ANNOUNCED' && deal?.announce_date ? null : rawStatus;
  const compactValue = formatDealValue(deal?.value_usd);
  const inAgreement = view === 'agreement';

  return (
    <header className="mtx-masthead sticky top-0 z-30 bg-white border-b border-[#E0E0E0]">
      {/* Below md the row wraps (auto height) instead of clipping at a fixed
          108px — ProvisionNav's hardcoded top-[108px]/calc(100vh-108px) only
          matters from md up, where this stays a single fixed-height row
          exactly as before. Below md the toggle and a condensed metric line
          wrap onto their own row rather than disappearing. */}
      <div className="flex flex-wrap md:flex-nowrap items-center gap-x-4 lg:gap-x-6 px-5 lg:px-8 py-3 md:py-0 md:h-[108px]">
        {/* Identity */}
        <div className="shrink-0 min-w-0">
          {/* Ben (Mergertrace round 1): title in the metric-value voice
              (Inter bold, same family as the "Sep 21, 2025" numerals), sized
              down so the full masthead fits; acquirer at the SAME size as
              the target. */}
          <h1 className="min-w-0 truncate text-base lg:text-lg font-bold leading-tight tracking-tight text-[#1F1F1F] mt-0.5">
            {targetName}
          </h1>
          {/* Item 4 (round 3): party names survive LAST at narrow widths --
              this line is always visible now (no `hidden sm:`). Below sm the
              "ACQUIRED BY" eyebrow label hides and a plain "/" separator
              takes its place, so the narrowest layout still reads
              "Metsera / Pfizer" instead of losing the acquirer entirely. */}
          <div className="flex items-baseline gap-1.5 mt-0.5 min-w-0">
            {acquirerName ? (
              <span className="min-w-0 truncate text-base lg:text-lg font-bold leading-tight tracking-tight text-[#1F1F1F]">
                <span className="hidden sm:inline mtx-meta-label text-[9px] tracking-[0.14em] mr-1.5 align-middle">ACQUIRED BY</span>
                <span className="sm:hidden mr-1 text-[#6B6B6B]" aria-hidden="true">/</span>
                {acquirerName}
              </span>
            ) : null}
            {status ? (
              <>
                <span aria-hidden="true" className="text-[10px] text-[#6B6B6B]">→</span>
                <span className="inline-flex items-center px-2 py-0.5 border border-[#BDBDBD] text-[9px] font-bold uppercase tracking-wider text-[#1F1F1F]">
                  {status}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {/* Metric columns — full detail, md+ (the strip's own overflow-x-auto
            absorbs the squeeze between md and lg). */}
        {/* Ben (round 3): masthead height is FIXED — the strip must never
            grow the bar. Values shrink and truncate at narrow widths
            (full value on hover); the two lowest-priority columns drop
            below lg/xl. */}
        <div className="hidden md:flex items-stretch h-full flex-1 min-w-0 overflow-hidden">
          {/* mx-auto centres the strip when it fits and degrades to a clean
              left-origin scroll when it overflows (justify-center would clip
              the leading columns). */}
          <div className="flex items-stretch h-full mx-auto min-w-0">
            {metrics.map((m, i) => (
              <div
                key={m.label}
                className={`flex flex-col justify-center px-2 lg:px-4 min-w-0 ${m.priority === 3 ? 'hidden xl:flex' : m.priority === 2 ? 'hidden lg:flex' : ''}`}
                style={i !== 0 ? { borderLeft: '1px solid #E0E0E0' } : undefined}
              >
                <div className="mtx-meta-label text-[9px] tracking-[0.14em] whitespace-nowrap">{m.label}</div>
                {/* r11 (Ben): never "…" — values wrap to two tight lines
                    inside the fixed bar (overflow simply hides, no
                    ellipsis); full value stays on hover. */}
                <div
                  className="text-xs lg:text-sm font-bold leading-tight text-[#1F1F1F] mt-0.5 break-words max-w-[13rem] overflow-hidden"
                  style={{ maxHeight: '2.4em' }}
                  title={m.value}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Condensed metric line — between ~480px and md only. Item 4: below
            480px this also disappears so ONLY "Metsera / Pfizer" (+ the
            toggle button, wrapped to its own row) survives at the
            narrowest widths -- matches the metric strip's own Inter
            font-bold styling, never the mtx-serif (Tinos/Times) face. */}
        {compactValue ? (
          <div className="hidden min-[480px]:flex md:hidden items-center gap-1.5 text-[#6B6B6B] min-w-0">
            <span className="font-ui text-base font-bold text-[#1F1F1F] whitespace-nowrap">{compactValue}</span>
          </div>
        ) : null}

        {/* Action button — same slot toggles between the two views. Always
            reachable: below md it wraps onto its own line via flex-wrap on
            the parent rather than being hidden. */}
        <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-auto lg:ml-0">
          <ClauseSearchToggle />
          {hasAgreementText ? (
            <button
              type="button"
              onClick={onToggleView}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#1F1F1F] text-[10px] font-bold uppercase tracking-wider text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white transition whitespace-nowrap"
            >
              {inAgreement ? '← Back to Summary' : 'Full Merger Agreement →'}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#E0E0E0] text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] opacity-60 cursor-not-allowed whitespace-nowrap"
            >
              Full Merger Agreement <span className="normal-case font-medium tracking-normal">(no source text)</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
