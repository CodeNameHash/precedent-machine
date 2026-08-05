import { HoverSource, humanizeBadgeText } from './shared';
import { SeeProvisionDisclosure } from './primitives/ProvisionTablePrimitives';

function money(value, formula) {
  if (value !== null && value !== undefined && value !== '') return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  return formula || null;
}

function stock(value, formula) {
  if (value !== null && value !== undefined && value !== '') return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 })} Parent shares`;
  return formula || null;
}

function optionConsideration(option) {
  if (!option) return '—';
  const cash = money(option.cash_per_share ?? option.cashPerShare, option.cash_per_share_formula || option.cashPerShareFormula);
  const shares = stock(option.stock_per_share ?? option.stockPerShare, option.stock_per_share_formula || option.stockPerShareFormula);
  if (cash && shares) return `${cash} + ${shares}`;
  if (cash) return cash;
  if (shares) return shares;
  if (option.cvr_included === true || option.cvrIncluded === true) return 'Includes CVR';
  if (option.cvr_included === false || option.cvrIncluded === false) return 'No CVR';
  return 'See source';
}

function capText(option) {
  const type = option.aggregate_cap_type || option.aggregateCapType;
  const value = option.aggregate_cap_value || option.aggregateCapValue;
  if (!type && !value) return 'No cap';
  if (type === 'NO_CAP') return 'No cap';
  return value ? `${humanizeBadgeText(type || 'Cap')}: ${value}` : humanizeBadgeText(type || 'Cap');
}

function optionLabel(option) {
  return option.option_label || option.optionLabel || humanizeBadgeText(option.option_type || option.optionType || 'Election Option');
}

export default function ElectionCard({ election }) {
  if (!election) return null;
  const options = Array.isArray(election.options) ? election.options : [];
  if (options.length < 2) return null;
  const proration = election.proration_rule || election.prorationRule || null;
  const defaultTreatment = election.default_treatment || election.defaultTreatment || null;
  const deadlineRef = election.election_deadline_ref || election.electionDeadlineRef || null;
  const deadlineQuote = election.election_deadline_quote || election.electionDeadlineQuote || null;

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-sky-50 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-sky-900 uppercase tracking-wider">Election</p>
      </div>
      <div className="p-3 space-y-3">
        <p className="text-xs font-ui text-inkLight">Shareholders may elect ONE of the following:</p>
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          {options.map((option, index) => (
            <div key={option.id || `${option.option_type || option.optionType}-${index}`} className="flex flex-col md:flex-row gap-3 items-stretch flex-1">
              {index > 0 ? (
                <div className="flex items-center justify-center text-[10px] font-ui font-semibold text-inkFaint uppercase tracking-wider md:w-6">
                  OR
                </div>
              ) : null}
              <div className="border border-border rounded-lg bg-bg/20 p-3 space-y-2 flex-1 min-w-0">
                <div>
                  <p className="text-[10px] font-ui font-semibold text-ink uppercase tracking-wider">{optionLabel(option)}</p>
                  <p className="mt-1 text-sm font-ui text-ink">{optionConsideration(option)}</p>
                </div>
                <p className="text-xs font-ui text-inkLight">{capText(option)}</p>
                {option.cvr_note || option.cvrNote ? (
                  <p className="text-xs font-ui text-inkLight">{option.cvr_note || option.cvrNote}</p>
                ) : null}
                <HoverSource quote={option.verbatim_quote || option.verbatimQuote} as="div">
                  <blockquote className="text-xs font-body text-ink leading-relaxed border-l-2 border-sky-200 pl-2 line-clamp-4">
                    {option.verbatim_quote || option.verbatimQuote}
                  </blockquote>
                </HoverSource>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-ui">
          {defaultTreatment ? (
            <div className="border border-border rounded-lg p-2 bg-bg/20">
              <p className="text-[10px] uppercase tracking-wider text-inkFaint mb-1">Default</p>
              <p className="text-ink">{humanizeBadgeText(defaultTreatment)}</p>
            </div>
          ) : null}
          {(deadlineRef || deadlineQuote) ? (
            <div className="border border-border rounded-lg p-2 bg-bg/20">
              <p className="text-[10px] uppercase tracking-wider text-inkFaint mb-1">Deadline</p>
              <HoverSource quote={deadlineQuote} as="p" className="text-ink">
                {deadlineRef || deadlineQuote}
              </HoverSource>
            </div>
          ) : null}
        </div>

        {proration ? (
          <div className="border border-border rounded-lg bg-bg/20 p-3 space-y-2">
            <p className="text-[10px] font-ui font-semibold text-ink uppercase tracking-wider">Proration</p>
            {proration.proration_walkthrough || proration.prorationWalkthrough ? (
              <div>
                <p className="text-[10px] font-ui uppercase tracking-wider text-inkFaint mb-1">Plain-language summary</p>
                <p className="text-xs font-ui text-ink">{proration.proration_walkthrough || proration.prorationWalkthrough}</p>
              </div>
            ) : null}
            <SeeProvisionDisclosure
              as="div"
              className="text-xs font-ui"
              triggerClassName="cursor-pointer text-accent hover:underline"
              label="Source proration language"
            >
              <HoverSource quote={proration.verbatim_quote || proration.verbatimQuote} as="blockquote" className="mt-2 text-xs font-body text-ink leading-relaxed border-l-2 border-sky-200 pl-2">
                {proration.verbatim_quote || proration.verbatimQuote}
              </HoverSource>
            </SeeProvisionDisclosure>
          </div>
        ) : null}
      </div>
    </div>
  );
}
