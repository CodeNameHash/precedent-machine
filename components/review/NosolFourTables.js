import { useState } from 'react';
import { evidenceQuote, isCitableValue, getCitableValue } from '../../lib/citable';
import {
  useShowEvidence,
  HoverSource,
  Pill,
  renderSummaryRowValue,
} from './shared';
import { TermCell } from './TermCell';
import {
  canonicalizeNosolPills,
  goShopDisplay,
  NOSOL_COR_LIFECYCLE_LABELS,
  nosolDefinitionChainRows,
  nosolDefinitionInitialState,
  noticePeriodParts,
  pickNosolFeature,
  prohibitedActPills,
  representativeStandardDisplay,
  superiorProposalLimbs,
} from './table-logic';

// Audit block 1: the parser sometimes emits a bare digit for duration-typed
// features ("4" instead of "4 business days"). Append the unit ONLY when the
// value is a bare number — text that already carries units passes through
// untouched. Only the display value changes; the underlying hit (and its
// evidence quote) is left intact so hover/click-to-source keep working.
function withUnitSuffix(hit, unit) {
  if (!hit || !unit) return hit;
  const raw = hit.value;
  const inner = isCitableValue(raw) ? getCitableValue(raw) : raw;
  const isBareNumber = typeof inner === 'number' || (typeof inner === 'string' && /^\d+(\.\d+)?$/.test(inner.trim()));
  if (!isBareNumber) return hit;
  const suffixed = `${inner} ${unit}`;
  const newValue = isCitableValue(raw) ? { ...raw, value: suffixed } : suffixed;
  return { ...hit, value: newValue };
}

/* ─── P3 item 1: NOSOL — 4 stacked mini-tables ──
 *  Cease-Discussions / Change-of-Recommendation Framework / Key Definitions /
 *  Other Restrictions. Each is a 2-column (Feature | Value) bringdown-style
 *  mini-table. All rows use the same row-resolution logic as
 *  CategoryFeatureSummaryTable: scan provisions for the first non-empty
 *  feature among `keys`. Empty rows render the "Not present" italic
 *  placeholder, with sorting (P3 item 5) putting populated rows first. */
const NOSOL_CEASE_DISCUSSIONS = [
  { label: 'Prohibited Acts',                          keys: ['ceaseDiscussionsProhibitedList'], kind: 'prohibitedActs' },
  { label: 'Standard for affiliates/representatives',  keys: ['representativesStandard', 'ceaseDiscussionsAffiliateStandard'], kind: 'representativeStandard' },
  { label: 'Express liability for representative breach', keys: ['ceaseDiscussionsLiability', 'representativeBreachIsCompanyBreach'] },
  { label: 'Exceptions',                               keys: ['ceaseDiscussionsExceptions'] },
];
const NOSOL_CHANGE_OF_REC = [
  { label: NOSOL_COR_LIFECYCLE_LABELS[0], keys: ['changeOfRecommendationItems'], kind: 'canonicalPills', vocab: 'changeOfRecommendationItems' },
  { label: NOSOL_COR_LIFECYCLE_LABELS[1], keys: ['notChangeOfRecommendationItems'], kind: 'canonicalPills', vocab: 'notChangeOfRecommendationItems' },
  { label: 'Engagement standard (to discuss with a third party)', keys: ['engagementStandard', 'fiduciaryEngageStandard'] },
  { label: 'Notice period',                            keys: ['noticePeriod'], kind: 'noticePeriod' },
  { label: 'Notice content',                           keys: ['noticeContent'], kind: 'canonicalPills', vocab: 'noticeContent' },
  { label: 'Standstill waiver permitted',              keys: ['standstillWaiverPermitted', 'standstillWaiver'] },
  { label: 'Anti-clubbing waiver permitted',           keys: ['antiClubbingWaiverPermitted'] },
  { label: 'Initial match period',                     keys: ['initialMatchPeriodDays', 'matchingPeriod'], unit: 'business days' },
  { label: 'Subsequent match period (per material amendment)', keys: ['subsequentMatchPeriodDays', 'subsequentMatchingPeriod'], unit: 'business days' },
  { label: 'Change-of-recommendation standard',        keys: ['changeRecStandard', 'fiduciaryFinalStandard'] },
  { label: 'Material improvement standard',            keys: ['superiorProposalTest'], kind: 'superiorProposalLimbs' },
];
const NOSOL_KEY_DEFINITIONS = [
  // FB3 missed item 6: the real "Superior [Company] Proposal" / "Company
  // Takeover Proposal" definitions are sourced from the deal's own DEF
  // provisions (see nosolDefinitionChainRows / extraRows below) — the old
  // feature-key row here never resolved real data (acquisitionTransaction*
  // isn't a field any provision actually carries).
  { label: 'Superior Proposal — threshold %',          keys: ['superiorProposalThresholdPct', 'superiorProposalPercentage'] },
  { label: 'Superior Proposal — test',                 keys: ['superiorProposalTest'] },
  { label: 'Superior Proposal — determiner',           keys: ['superiorProposalDeterminer'] },
  { label: 'Intervening Event — definition',           keys: ['interveningEventDefinition'] },
  { label: 'Intervening Event — scope',                keys: ['interveningEventScope'] },
  { label: 'Acceptable Confidentiality Agreement',     keys: ['acceptableConfidentialityAgreementDefinition'] },
];
const NOSOL_OTHER_RESTRICTIONS = [
  { label: 'Force the Vote',                           keys: ['forceTheVote', 'forceTheVoteDetails'] },
  { label: 'Parent Termination Right for Nonsolicit Breach', keys: ['parentTerminationRightForNonsolicitBreach'] },
];

function PillStrip({ pills, tone = 'standard' }) {
  const list = (pills || []).filter(Boolean);
  if (list.length === 0) return <span className="italic text-inkFaint">Not present in this agreement</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((pill, idx) => (
        <Pill
          key={`${pill.code || pill.label}-${idx}`}
          text={pill.label}
          quote={pill.quote}
          tone={tone}
          highlight={null}
        />
      ))}
    </div>
  );
}

function renderNosolCustomValue(row, hit, provisions) {
  if (row.kind === 'prohibitedActs') {
    return <PillStrip pills={prohibitedActPills(provisions)} />;
  }
  if (row.kind === 'representativeStandard') {
    const display = representativeStandardDisplay(hit && hit.value);
    return display
      ? <Pill text={display.label} quote={display.quote} tone="standard" highlight={null} />
      : <span className="italic text-inkFaint">Not present in this agreement</span>;
  }
  if (row.kind === 'canonicalPills') {
    return <PillStrip pills={canonicalizeNosolPills(hit && hit.value, row.vocab)} />;
  }
  if (row.kind === 'noticePeriod') {
    const parts = noticePeriodParts(hit && hit.value);
    return parts ? <PillStrip pills={parts} /> : renderSummaryRowValue(hit, row.keys[0]);
  }
  if (row.kind === 'superiorProposalLimbs') {
    const limbs = superiorProposalLimbs(hit && hit.value);
    if (limbs.length === 0) return <span className="italic text-inkFaint">Not present in this agreement</span>;
    return (
      <div className="space-y-1.5">
        {limbs.map((limb) => (
          <HoverSource key={limb.label} quote={limb.quote} as="div">
            <div className="rounded border border-border bg-bg/40 px-2 py-1">
              <div className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">{limb.label}</div>
              <div className="text-xs text-ink whitespace-pre-wrap break-words">{limb.text}</div>
            </div>
          </HoverSource>
        ))}
      </div>
    );
  }
  return null;
}

// FB3 missed item 6: a DEF-provision-sourced definition row (optionally with
// one indented, one-level-deep chained child row) — flattened into a plain
// array so it slots into the same <tbody> as the feature-key spec rows
// without a Fragment. `indent` styles the child row's label cell.
function flattenNosolExtraRows(extraRows) {
  const out = [];
  for (const row of extraRows || []) {
    if (!row) continue;
    out.push({ ...row, indent: 0 });
    if (row.child) out.push({ ...row.child, indent: 1, term: `${row.term}__child` });
  }
  return out;
}

function NosolDefRow({ row }) {
  const showEvidence = useShowEvidence();
  const quote = row.quote || null;
  const clickable = !!(quote && showEvidence);
  return (
    <tr key={row.term} className={`hover:bg-bg/40 transition-colors ${row.indent ? 'bg-bg/20' : ''}`}>
      <td className="px-3 py-2 align-top whitespace-normal break-words">
        <TermCell provision={row.provision} quote={quote}>
          <span className={`text-ink font-medium ${row.indent ? 'pl-4 inline-flex items-baseline gap-1' : ''}`}>
            {row.indent ? <span className="text-inkFaint">↳</span> : null}
            {row.label}
          </span>
        </TermCell>
      </td>
      <td
        className={`px-3 py-2 align-top text-ink whitespace-pre-wrap break-words ${clickable ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
        onClick={clickable ? () => showEvidence(quote) : undefined}
      >
        <HoverSource quote={quote} as="div">
          {row.text || <span className="italic text-inkFaint">Not present in this agreement</span>}
        </HoverSource>
      </td>
    </tr>
  );
}

function NosolMiniTable({ title, spec, provisions, headerNote, collapsibleDefinitions = false, extraRows = null }) {
  const showEvidence = useShowEvidence();
  const [collapsedDefs, setCollapsedDefs] = useState(() => (
    collapsibleDefinitions ? nosolDefinitionInitialState(spec.map((row) => row.label)) : new Set()
  ));
  const rawRows = spec.map((row, originalIdx) => {
    const picked = pickNosolFeature(provisions, row.keys);
    const hit = withUnitSuffix(picked, row.unit);
    return { ...row, hit, lookupKey: row.keys[0] || null, originalIdx };
  });
  const rows = rawRows;

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          {title}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">Feature</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {headerNote && (
              <tr className="bg-bg/30">
                <td colSpan={2} className="px-3 py-2 text-[11px] font-ui italic text-inkMid">
                  {headerNote}
                </td>
              </tr>
            )}
            {flattenNosolExtraRows(extraRows).map((row) => (
              <NosolDefRow key={row.term} row={row} />
            ))}
            {rows.map((row) => {
              const collapsed = collapsibleDefinitions && collapsedDefs.has(row.label);
              const customValue = collapsed ? null : renderNosolCustomValue(row, row.hit, provisions);
              const quote = row.hit
                ? evidenceQuote(row.hit.value, { provision: row.hit.provision })
                : null;
              const clickable = !!(quote && showEvidence) && !customValue && !collapsed;
              const onClick = clickable ? () => showEvidence(quote) : undefined;
              const toggleDefinition = collapsibleDefinitions
                ? () => setCollapsedDefs((prev) => {
                  const next = new Set(prev);
                  if (next.has(row.label)) next.delete(row.label);
                  else next.add(row.label);
                  return next;
                })
                : null;
              return (
                <tr key={row.label} className="hover:bg-bg/40 transition-colors">
                  <td className="px-3 py-2 align-top whitespace-normal break-words">
                    <TermCell provision={row.hit && row.hit.provision} quote={quote}>
                    {toggleDefinition ? (
                      <button
                        type="button"
                        onClick={toggleDefinition}
                        className="text-left text-accent hover:underline font-medium"
                        aria-expanded={!collapsed}
                      >
                        <span className="mr-1 text-inkFaint">{collapsed ? '+' : '-'}</span>
                        {row.label}
                      </button>
                    ) : clickable ? (
                      <HoverSource quote={quote}>
                        <button
                          type="button"
                          onClick={onClick}
                          className="text-left text-accent hover:underline font-medium"
                        >
                          {row.label}
                        </button>
                      </HoverSource>
                    ) : (
                      <span className="text-ink font-medium">{row.label}</span>
                    )}
                    </TermCell>
                  </td>
                  <td
                    className={`px-3 py-2 align-top text-ink whitespace-pre-wrap break-words ${clickable ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
                    onClick={onClick}
                  >
                    {collapsed ? null : (
                      customValue || (
                        <HoverSource quote={quote} as="div">
                          {renderSummaryRowValue(row.hit, row.lookupKey)}
                        </HoverSource>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NosolGoShopTop({ provisions }) {
  const display = goShopDisplay(provisions);
  if (!display.present) {
    return (
      <div className="bg-white border border-border rounded-lg shadow-sm px-3 py-2">
        <p className="text-xs font-ui text-ink">No go-shop.</p>
      </div>
    );
  }
  return (
    <NosolMiniTable
      title="Go-Shop"
      spec={[
        // Audit-2 item 6(c): goShopPeriodDays / extendedNegotiatingPeriodDays
        // are, by the extraction schema itself (lib/rubric.js — "Go-shop
        // period (days)"), always a count of DAYS — appending "days" to a
        // bare number here isn't guessing a unit, it's using the field's own
        // documented one (same unit withUnitSuffix already applies for these
        // exact keys via formatDurationWithUnits' EXACT map elsewhere).
        // withUnitSuffix only suffixes a genuinely BARE number — a
        // goShopWindow fallback value that's already free text with its own
        // unit embedded passes through unchanged, never double-suffixed.
        { label: 'Go-Shop Period', keys: ['goShopPeriodDays', 'goShopWindow'], unit: 'days' },
        { label: 'Go-Shop Excluded Parties', keys: ['goShopExcludedParties'] },
        { label: 'Extended Negotiating Period', keys: ['extendedNegotiatingPeriodDays'], unit: 'days' },
      ]}
      provisions={provisions}
    />
  );
}

export function NosolFourTables({ provisions, allProvisions }) {
  // FB3 missed item 6: Superior Company Proposal / Company Takeover Proposal
  // (+ one-level-deep chained reference) sourced from the deal's own DEF
  // provisions — needs the full deal, not just the NOSOL-filtered pool.
  const defChainRows = nosolDefinitionChainRows(allProvisions || provisions);
  return (
    <div className="space-y-3">
      <NosolGoShopTop provisions={provisions} />
      <NosolMiniTable
        title="Cease Discussions"
        spec={NOSOL_CEASE_DISCUSSIONS}
        provisions={provisions}
      />
      <NosolMiniTable
        title="Change of Recommendation Framework"
        spec={NOSOL_CHANGE_OF_REC}
        provisions={provisions}
        headerNote="Board may change recommendation? Yes — subject to compliance with the framework below."
      />
      <NosolMiniTable
        title="Key Definitions"
        spec={NOSOL_KEY_DEFINITIONS}
        provisions={provisions}
        collapsibleDefinitions
        extraRows={defChainRows}
      />
      <NosolMiniTable
        title="Other Restrictions"
        spec={NOSOL_OTHER_RESTRICTIONS}
        provisions={provisions}
      />
    </div>
  );
}
