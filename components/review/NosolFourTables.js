import { evidenceQuote, isCitableValue, getCitableValue } from '../../lib/citable';
import {
  useShowEvidence,
  pickFirstNonEmpty,
  HoverSource,
  renderSummaryRowValue,
} from './shared';

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
  { label: 'Prohibited acts',                          keys: ['ceaseDiscussionsProhibitedList'] },
  { label: 'Standard for affiliates / representatives', keys: ['ceaseDiscussionsAffiliateStandard', 'representativesStandard'] },
  { label: 'Liability for representative breach',      keys: ['ceaseDiscussionsLiability', 'representativeBreachIsCompanyBreach'] },
  { label: 'Exceptions',                               keys: ['ceaseDiscussionsExceptions'] },
];
const NOSOL_CHANGE_OF_REC = [
  { label: 'What constitutes a Change of Recommendation', keys: ['changeOfRecommendationItems'] },
  { label: 'What does NOT constitute a Change of Recommendation', keys: ['notChangeOfRecommendationItems'] },
  { label: 'Engagement standard (to discuss with a third party)', keys: ['engagementStandard', 'fiduciaryEngageStandard'] },
  { label: 'Change-of-recommendation standard',        keys: ['changeRecStandard', 'fiduciaryFinalStandard'] },
  { label: 'Notice Period (to existing buyer, upon receipt of a proposal)', keys: ['noticePeriod'], unit: 'hours' },
  { label: 'Notice Content',                           keys: ['noticeContent'] },
  { label: 'Initial match period',                     keys: ['initialMatchPeriodDays', 'matchingPeriod'], unit: 'business days' },
  { label: 'Subsequent match period (per material amendment)', keys: ['subsequentMatchPeriodDays', 'subsequentMatchingPeriod'], unit: 'business days' },
  { label: 'Material-improvement standard',            keys: ['materialImprovementStandard'] },
];
const NOSOL_KEY_DEFINITIONS = [
  { label: 'Company Takeover Proposal / Acquisition Proposal', keys: ['acquisitionTransactionDefinition', 'acquisitionTransactionPctThreshold'] },
  { label: 'Superior Proposal — threshold %',          keys: ['superiorProposalThresholdPct', 'superiorProposalPercentage'] },
  { label: 'Superior Proposal — test',                 keys: ['superiorProposalTest'] },
  { label: 'Superior Proposal — determiner',           keys: ['superiorProposalDeterminer'] },
  { label: 'Intervening Event — definition',           keys: ['interveningEventDefinition'] },
  { label: 'Intervening Event — scope',                keys: ['interveningEventScope'] },
  { label: 'Acceptable Confidentiality Agreement',     keys: ['acceptableConfidentialityAgreementDefinition'] },
];
const NOSOL_OTHER_RESTRICTIONS = [
  { label: 'Go-Shop Present',                          keys: ['goShopPresent'] },
  { label: 'Go-Shop Period',                           keys: ['goShopPeriodDays', 'goShopWindow'] },
  { label: 'Go-Shop Excluded Parties',                 keys: ['goShopExcludedParties'] },
  { label: 'Extended Negotiating Period',              keys: ['extendedNegotiatingPeriodDays'] },
  { label: 'Standstill Waiver Permitted',              keys: ['standstillWaiverPermitted', 'standstillWaiver'] },
  { label: 'Anti-Clubbing Waiver Permitted',           keys: ['antiClubbingWaiverPermitted'] },
  { label: 'Info Required — Bidder Identity',          keys: ['infoRequiredBidderIdentity'] },
  { label: 'Info Required — Communications & Drafts',  keys: ['infoRequiredCommunicationsDrafts'] },
  { label: 'Info Required — Financing Papers',         keys: ['infoRequiredFinancingPapers'] },
  { label: 'Force the Vote',                           keys: ['forceTheVote', 'forceTheVoteDetails'] },
  { label: 'Parent Termination Right for Nonsolicit Breach', keys: ['parentTerminationRightForNonsolicitBreach'] },
];

function NosolMiniTable({ title, spec, provisions, headerNote }) {
  const showEvidence = useShowEvidence();
  const rawRows = spec.map((row, originalIdx) => {
    const hit = withUnitSuffix(pickFirstNonEmpty(provisions, row.keys), row.unit);
    return { label: row.label, hit, lookupKey: row.keys[0] || null, originalIdx };
  });
  const rows = [...rawRows].sort((a, b) => {
    const aP = a.hit !== null && a.hit !== undefined;
    const bP = b.hit !== null && b.hit !== undefined;
    if (aP !== bP) return aP ? -1 : 1;
    return a.originalIdx - b.originalIdx;
  });

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          {title}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap w-[190px] min-w-[190px] max-w-[190px]">Feature</th>
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
            {rows.map((row) => {
              const quote = row.hit
                ? evidenceQuote(row.hit.value, { provision: row.hit.provision })
                : null;
              const clickable = !!(quote && showEvidence);
              const onClick = clickable ? () => showEvidence(quote) : undefined;
              return (
                <tr key={row.label} className="hover:bg-bg/40 transition-colors">
                  <td className="px-3 py-2 align-top whitespace-normal break-words">
                    {clickable ? (
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
                  </td>
                  <td
                    className={`px-3 py-2 align-top text-ink whitespace-pre-wrap break-words ${clickable ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
                    onClick={onClick}
                  >
                    <HoverSource quote={quote} as="div">
                      {renderSummaryRowValue(row.hit, row.lookupKey)}
                    </HoverSource>
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

export function NosolFourTables({ provisions }) {
  return (
    <div className="space-y-3">
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
      />
      <NosolMiniTable
        title="Other Restrictions"
        spec={NOSOL_OTHER_RESTRICTIONS}
        provisions={provisions}
      />
    </div>
  );
}
