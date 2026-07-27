import { useMemo, useState } from 'react';

const SECTION_LABELS = Object.freeze({
  TIMING: 'Timing',
  RESTRICTIONS: 'Restrictions',
  EXCEPTIONS: 'Exceptions',
});

function formatCode(value) {
  if (value === null || value === undefined) return 'Not applicable';
  if (typeof value === 'object') return Object.values(value).map(formatCode).join(' · ');
  const text = String(value)
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
    .replace(/\bmae\b/gi, 'MAE');
}

function formatParty(party) {
  if (!party) return 'Party not captured';
  if (party.value) return `${formatCode(party.value)} (${formatCode(party.capacity)})`;
  return [
    party.obligated_party
      ? `Obligor: ${formatParty(party.obligated_party)}`
      : null,
    party.protected_party
      ? `Protected: ${formatParty(party.protected_party)}`
      : null,
  ].filter(Boolean).join(' · ');
}

function formatTrigger(trigger) {
  if (!trigger) return 'Trigger not captured';
  if (typeof trigger === 'string') return formatCode(trigger);
  if (trigger.code) return formatCode(trigger.code);
  return formatCode(trigger);
}

function rawValue(subject) {
  if (typeof subject.raw_value === 'string') return subject.raw_value;
  if (typeof subject.raw_value?.text === 'string') {
    return subject.raw_value.text;
  }
  if (subject.raw_value?.magnitude) {
    return `${subject.raw_value.magnitude} ${formatCode(subject.raw_value.unit).toLowerCase()}`;
  }
  return null;
}

function durationLabel(subject) {
  const amount = Number(subject.canonical_value);
  const basis = subject.day_basis === 'BUSINESS' ? 'business day' : 'elapsed day';
  const outsideCap =
    `${subject.canonical_value} ${basis}${amount === 1 ? '' : 's'}`;
  if (subject.timing_semantics?.promptly_qualifier
    && subject.timing_semantics.outside_cap_semantic_code
      === 'PROMPTLY_AND_NO_LATER_THAN_STATED_DURATION') {
    return `Promptly, and no later than ${outsideCap}`;
  }
  return outsideCap;
}

function percentage(count, denominator) {
  if (!Number.isFinite(count) || !Number.isFinite(denominator) || denominator < 1) return null;
  return Math.round((count / denominator) * 100);
}

function DurationRange({ row }) {
  const points = row.market_context.distribution
    .map((entry) => ({
      value: Number(entry.canonical_value),
      weight: Number(entry.deal_count),
    }))
    .filter((entry) => (
      Number.isFinite(entry.value)
      && Number.isSafeInteger(entry.weight)
      && entry.weight > 0
    ))
    .sort((left, right) => left.value - right.value);
  const subject = Number(row.subject.canonical_value);
  const totalWeight = points.reduce(
    (sum, entry) => sum + entry.weight,
    0,
  );
  const min = points[0]?.value ?? subject;
  const max = points.at(-1)?.value ?? subject;
  const mean = totalWeight
    ? points.reduce(
      (sum, entry) => sum + (entry.value * entry.weight),
      0,
    ) / totalWeight
    : subject;
  const atRank = (rank) => {
    let cumulative = 0;
    for (const entry of points) {
      cumulative += entry.weight;
      if (cumulative >= rank) return entry.value;
    }
    return subject;
  };
  const median = totalWeight
    ? totalWeight % 2 === 0
      ? (
        atRank(totalWeight / 2)
        + atRank((totalWeight / 2) + 1)
      ) / 2
      : atRank((totalWeight + 1) / 2)
    : subject;
  const position = max === min ? 50 : ((subject - min) / (max - min)) * 100;
  return (
    <div className="mt-4" data-duration-range={row.metric_key}>
      <div className="relative h-6">
        <div className="absolute left-0 right-0 top-3 h-px bg-[#BDB9B0]" />
        <div
          className="absolute top-[7px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-[#2F6DB5] shadow"
          style={{ left: `${Math.max(2, Math.min(98, position))}%` }}
          aria-label={`Selected deal: ${durationLabel(row.subject)}`}
        />
      </div>
      <div className="grid grid-cols-4 gap-2 text-[9px] text-[#77736C]">
        <div><span className="font-bold text-[#1F1F1F]">{min}</span><br />Min</div>
        <div><span className="font-bold text-[#1F1F1F]">{median}</span><br />Median</div>
        <div><span className="font-bold text-[#1F1F1F]">{mean.toFixed(1)}</span><br />Mean</div>
        <div className="text-right"><span className="font-bold text-[#1F1F1F]">{max}</span><br />Max</div>
      </div>
    </div>
  );
}

function semanticLines(item, row) {
  const context = item.semantic_context || {};
  if (row.metric_key === 'NO_SHOP_ACTION_KNOWLEDGE_QUALIFIER') {
    return [
      `Action: ${formatCode(context.action_code)}`,
      `Qualifier: ${formatCode(item.canonical_value)}`,
    ];
  }
  if (row.metric_key === 'NO_SHOP_EXCEPTION_PREREQUISITE') {
    return [
      `Scope: ${formatCode(context.prerequisite_class)}`,
      context.applies_to_effect_keys?.length
        ? `Applies to: ${context.applies_to_effect_keys.map(formatCode).join(', ')}`
        : 'Applies to: no certified exception effect',
    ];
  }
  if (row.metric_key === 'NO_SHOP_EXCEPTION_EFFECT') {
    return [
      `Affected action: ${formatCode(context.affected_action_code)}`,
      `Basis: ${context.derivation_mode === 'DIRECT_SOURCE_TEXT' ? 'Express source text' : 'Inferred from participation language'}`,
      context.direct_source_effect_key
        ? `Source effect: ${formatCode(context.direct_source_effect_key)}`
        : null,
      context.governing_notice_dependency
        ? `Notice dependency: ${formatCode(context.governing_notice_dependency)}`
        : null,
      context.relationship_materialisation_state
        ? `Relationship: ${formatCode(context.relationship_materialisation_state)}`
        : null,
    ].filter(Boolean);
  }
  if (row.metric_key === 'NO_SHOP_INLINE_PERMISSION_EFFECT') {
    return [
      `Actor: ${formatParty(context.permitted_actor_party)}`,
      `Permitted action: ${formatCode(context.permitted_action_code)}`,
      `Scope: ${formatCode(context.temporal_scope_inheritance)}`,
      `Qualifies ${context.qualified_action_outcomes?.length || 0} limb-B prohibited-action outcomes`,
      context.prerequisite_codes?.length
        ? `Prerequisites: ${context.prerequisite_codes.map(formatCode).join(', ')}`
        : 'Prerequisites: none borrowed from the proposal exception',
    ];
  }
  const occurrences =
    item.source?.source_occurrence_ids?.length || 0;
  return occurrences
    ? [`${occurrences} source occurrence${occurrences === 1 ? '' : 's'}`]
    : [];
}

function ItemCard({ item, row }) {
  const lines = semanticLines(item, row);
  const heading =
    row.metric_key === 'NO_SHOP_ACTION_KNOWLEDGE_QUALIFIER'
      ? `${formatCode(item.semantic_context.action_code)}: ${formatCode(item.canonical_value)}`
      : item.label;
  return (
    <div className="border border-[#D9D7D2] bg-[#F7F5F0] px-2.5 py-2">
      <div className="text-[9px] font-semibold text-[#1F1F1F]">{heading}</div>
      {lines.length ? (
        <div className="mt-1 space-y-0.5 text-[8px] leading-3 text-[#66625C]">
          {lines.map((line) => <div key={line}>{line}</div>)}
        </div>
      ) : null}
      <Warning warning={item.lawyer_warning} label={heading} />
    </div>
  );
}

function CurrentTerms({ row }) {
  if (row.comparison_kind === 'DURATION') {
    return (
      <div>
        <div className="text-lg font-bold text-[#1F1F1F]">{durationLabel(row.subject)}</div>
        {rawValue(row.subject) ? (
          <div className="mt-1 text-[10px] text-[#77736C]">Source wording: {rawValue(row.subject)}</div>
        ) : null}
        <dl className="mt-3 grid gap-2 text-[10px] sm:grid-cols-2">
          <div>
            <dt className="font-bold text-[#77736C]">Trigger</dt>
            <dd className="mt-0.5 text-[#1F1F1F]">{formatTrigger(row.subject.legal_trigger)}</dd>
          </div>
          <div>
            <dt className="font-bold text-[#77736C]">Party</dt>
            <dd className="mt-0.5 text-[#1F1F1F]">{formatParty(row.party)}</dd>
          </div>
        </dl>
      </div>
    );
  }
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#77736C]">
        {row.subject.items.length} captured terms in this deal
      </div>
      <div className="mt-2 grid gap-1.5">
        {row.subject.items.map((item) => (
          <ItemCard key={item.item_id} item={item} row={row} />
        ))}
      </div>
    </div>
  );
}

function marketEntryLabel(entry, row) {
  const value = formatCode(entry.canonical_value);
  if (row.metric_key === 'NO_SHOP_ACTION_KNOWLEDGE_QUALIFIER') {
    return `${formatCode(entry.action_code)}: ${value}`;
  }
  if (row.metric_key === 'NO_SHOP_EXCEPTION_PREREQUISITE') {
    return `${value} · ${formatCode(entry.prerequisite_class)}`;
  }
  if (row.metric_key === 'NO_SHOP_EXCEPTION_EFFECT') {
    return `${formatCode(entry.affected_action_code)} · ${value} · ${
      entry.derivation_mode === 'DIRECT_SOURCE_TEXT'
        ? 'Express'
        : 'Inferred'
    }`;
  }
  return value;
}

function MarketTerms({ row }) {
  const independent =
    row.market_context.independent_comparable_deals;
  if (independent < 1) {
    return (
      <div className="border-l-2 border-[#BDB9B0] bg-[#F7F5F0] px-3 py-2 text-[9px] leading-4 text-[#66625C]">
        One-deal certification preview. QXO is the selected deal and the only certified observation, so no market percentage or distribution is shown until an independent comparable deal is admitted.
      </div>
    );
  }
  if (row.comparison_kind === 'DURATION') {
    return (
      <div>
        <div className="text-[10px] leading-4 text-[#66625C]">
          Compared with {independent} independent deal{independent === 1 ? '' : 's'} on the same unit, day basis, trigger and party.
        </div>
        <DurationRange row={row} />
      </div>
    );
  }
  const denominator = independent;
  return (
    <div className="space-y-2">
      {row.market_context.distribution.map((entry, index) => {
        const share = percentage(entry.deal_count, denominator);
        return (
          <div
            key={`${entry.canonical_value}-${index}`}
            className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-3"
          >
            <div>
              <div className="truncate text-[9px] font-semibold text-[#1F1F1F]" title={marketEntryLabel(entry, row)}>
                {marketEntryLabel(entry, row)}
              </div>
              <div className="mt-1 h-1 bg-[#E8E5DE]">
                <div className="h-1 bg-[#2F6DB5]" style={{ width: `${share ?? 0}%` }} />
              </div>
            </div>
            <div className="text-right text-[9px] font-bold text-[#1F1F1F]">{share === null ? '—' : `${share}%`}</div>
          </div>
        );
      })}
      <div className="pt-1 text-[9px] text-[#77736C]">
        Deal-weighted within {denominator} independent comparable deal{denominator === 1 ? '' : 's'}. Repeated source occurrences do not double-count a deal.
      </div>
    </div>
  );
}

function Warning({ warning, label = null }) {
  if (!warning?.required) return null;
  return (
    <div className="mt-4 border-l-2 border-[#B27B16] bg-[#FFF9EC] px-3 py-2" role="note">
      <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#8A6417]">
        Lawyer review flag{label ? `: ${label}` : ''}
      </div>
      <p className="mt-1 text-[9px] leading-4 text-[#5F4A1E]">{warning.text}</p>
    </div>
  );
}

export default function NoShopCrossViewPreview({ preview }) {
  const rows = preview.provision_row.subrows;
  const [selectedMetric, setSelectedMetric] = useState(rows[0].metric_key);
  const [contextOpen, setContextOpen] = useState(true);
  const selected = rows.find((row) => row.metric_key === selectedMetric) || rows[0];
  const sections = useMemo(() => Object.entries(SECTION_LABELS).map(([key, label]) => ({
    key,
    label,
    rows: rows.filter((row) => row.section === key),
  })), [rows]);

  return (
    <section className="mt-5 overflow-hidden border border-[#D9D7D2] bg-white" data-f26-no-shop-preview="true">
      <header className="relative z-10 flex flex-wrap items-start justify-between gap-4 border-b border-[#D9D7D2] bg-[#F7F5F0] px-4 py-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">F26 inactive candidate release</div>
          <h2 className="mt-1 text-sm font-bold text-[#1F1F1F]">{preview.provision_row.label}</h2>
          <p className="mt-1 max-w-3xl text-[10px] leading-4 text-[#66625C]">
            One provision result across Review, Corpus Context, Compare and Query. This is a one-deal certification preview, not a market benchmark.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={contextOpen}
          aria-controls="f26-market-context"
          onClick={() => setContextOpen((open) => !open)}
          className="border border-[#BDB9B0] bg-white px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-[#1F1F1F] hover:border-[#2F6DB5] focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
        >
          {contextOpen ? 'Hide market context' : 'Show market context'}
        </button>
      </header>

      <div
        className={`grid min-w-0 ${contextOpen
          ? 'lg:grid-cols-[180px_minmax(0,1fr)_minmax(280px,340px)]'
          : 'lg:grid-cols-[180px_minmax(0,1fr)]'}`}
      >
        <nav className="border-b border-[#E6E4DF] bg-[#FBFAF7] p-3 lg:border-b-0 lg:border-r" aria-label="No-shop provision terms">
          {sections.map((section) => (
            <div key={section.key} className="mb-4 last:mb-0">
              <div className="mb-1 px-2 text-[8px] font-bold uppercase tracking-[0.12em] text-[#77736C]">{section.label}</div>
              <div className="space-y-0.5">
                {section.rows.map((row) => (
                  <button
                    key={row.metric_key}
                    type="button"
                    aria-pressed={selected.metric_key === row.metric_key}
                    onClick={() => {
                      setSelectedMetric(row.metric_key);
                      setContextOpen(true);
                    }}
                    className={`block w-full px-2 py-2 text-left text-[9px] leading-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#2F6DB5] ${
                      selected.metric_key === row.metric_key
                        ? 'bg-[#EAF1F9] font-bold text-[#174B84]'
                        : 'text-[#4E4B46] hover:bg-[#F2F0EA]'
                    }`}
                  >
                    {row.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="min-w-0 divide-y divide-[#E6E4DF]">
          {rows.map((row) => (
            <button
              key={row.subrow_id}
              type="button"
              onClick={() => {
                setSelectedMetric(row.metric_key);
                setContextOpen(true);
              }}
              className={`block w-full min-w-0 px-4 py-4 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#2F6DB5] ${
                selected.metric_key === row.metric_key ? 'bg-[#FCFDFE]' : 'bg-white hover:bg-[#FCFBF8]'
              }`}
              data-f26-subrow={row.metric_key}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#77736C]">{SECTION_LABELS[row.section]}</div>
                  <h3 className="mt-1 text-[11px] font-bold text-[#1F1F1F]">{row.label}</h3>
                </div>
                <span className="text-[8px] text-[#77736C]">{formatParty(row.party)}</span>
              </div>
              <div className="mt-3"><CurrentTerms row={row} /></div>
              <Warning warning={row.lawyer_warning} />
              <div className="mt-3 text-[8px] text-[#77736C]">
                Source-backed · {row.market_context.independent_comparable_deals} independent comparable deals · selected deal not treated as market evidence
              </div>
            </button>
          ))}
        </div>

        {contextOpen ? (
          <aside
            id="f26-market-context"
            className="min-w-0 border-t border-[#D9D7D2] bg-white p-4 lg:border-l lg:border-t-0"
            aria-label={`Market context for ${selected.label}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#77736C]">
                  {selected.market_context.independent_comparable_deals > 0
                    ? 'Market context'
                    : 'Certification context'}
                </div>
                <h3 className="mt-1 text-xs font-bold text-[#1F1F1F]">{selected.label}</h3>
              </div>
              <button
                type="button"
                onClick={() => setContextOpen(false)}
                className="px-2 py-1 text-[9px] font-bold text-[#77736C] hover:text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
                aria-label="Close market context"
              >
                Close
              </button>
            </div>
            <div className="mt-4 border-b border-[#E6E4DF] pb-4">
              <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#77736C]">Selected deal term</div>
              <div className="mt-2"><CurrentTerms row={selected} /></div>
            </div>
            <div className="pt-4">
              <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#77736C]">Comparable terms</div>
              <div className="mt-2"><MarketTerms row={selected} /></div>
            </div>
            <Warning warning={selected.lawyer_warning} />
            <div className="mt-4 border-t border-[#E6E4DF] pt-3 text-[8px] leading-4 text-[#77736C]">
              Presence is secondary. Comparisons use the exact metric, party, unit, trigger, basis and grouping dimensions admitted by this inactive release.
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
